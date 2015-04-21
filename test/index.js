
process.env['NPM_LOG'] = process.env['NPM_LOG']
|| 'silly'
|| 'info'
|| 'verbose'
;

require('should');
var fs = require('fs-extra');
var log = require('npmlog');
var Vagrant = require('node-vagrant-bin');

var NodeOps = require('../index.js');

var servers = require('./vagrant.json');
var profiles = require('./profiles.json');
var op = new NodeOps(servers, profiles);

var vagrant = new Vagrant();
var hasBooted = true;
before(function(done){
  this.timeout(50000);
  vagrant.isRunning(function(running){
    if(running===false){
      vagrant.up('precise64',function(err,booted){
        hasBooted = booted;
        done();
      });
    }else{
      console.log('running machine '+running);
      hasBooted = false;
      done();
    }
  });
});
after(function(done){
    this.timeout(50000);
    vagrant.isRunning(function(running){
      console.log('running machine '+running);
      if(hasBooted){
        vagrant.halt(function(){
          console.log('halted');
          done();
        });
      } else {
        done();
      }
    });
  });

before(function(){
  fs.removeSync(__dirname+'/app/conf_out/');
  fs.mkdirsSync(__dirname+'/app/conf_out/');
});

describe('generate', function(){
  this.timeout(50000)
  it('configuration files', function(done){
    op.generate( 'precise64::pool1', __dirname+'/app/conf_tpl/', __dirname+'/app/conf_out/', function(){
      fs.existsSync(__dirname+'/app/conf_out/httpd/ports.conf')
        .should.be.true;
      fs.readFileSync(__dirname+'/app/conf_out/httpd/vhosts/www.conf','utf-8')
        .indexOf(profiles.precise64.http.LogPath).should.not.eql(-1);
      done();
    });
  });
});

describe('ssh', function(){
  this.timeout(50000)
  it('say hello', function(done){
    op.exec( ':pool1', 'echo hello', function(err,stdout){
      stdout.should.match(/hello/);
      done();
    });
  });
});


describe('sftp', function(){
  this.timeout(50000);
  var localDirectoryPath = __dirname+'/app/conf_out/httpd';
  var remotePath = profiles.precise64.http.EtcPath+'/custom';
  before(function(done){
    op.exec( ':pool1', 'sudo rm -fr '+remotePath+' && ls -al '+remotePath, function(){
      done();
    });
  });
  it('push directory on a remote', function(done){
    var options = {};
    op.push( ':pool1', localDirectoryPath, remotePath, options, function(err,stdout){
      (!!err).should.be.false;
      stdout.should.match(/custom\/ports\.conf/);
      done();
    });
  });
});


describe('stream', function(){
  this.timeout(50000);
  it('streams file on a remote', function(done){
    var end = op.tail( ':pool1', '/var/log/auth.log', function(err,rstdout){
      (!!err).should.be.false;
      var data = '';
      rstdout.on('data',function(d){
        data += ''+d;
      });
      setTimeout(function(){
        (data).indexOf("vagrant-ubuntu-precise-64").should.not.eql(-1);
        end(done);
      },500);
    });
  });
});

