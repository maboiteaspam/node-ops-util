
var pkg = require('./package.json');
var SSH2pool = require('ssh2-pool');
var log = require('npmlog');

var NodeOps = function(servers){
  this.pool = new SSH2pool(servers);
  this.log = log;
};

NodeOps.prototype.push = function( env, localPath, remotePath, options ){

  var tmpRemotePath = options.tmp || '/tmp';
  var pool = this.pool;

  pool.env(env).putDir(localPath, tmpRemotePath, function(){

    var cmds = function(){
      return [
        'sudo rm -fr '+remotePath+'',
        'sudo mkdir -p '+remotePath+'',
        'sudo cp -R '+tmpRemotePath+'* '+remotePath+'',
        'msg:`All done!`'
      ]
    };
    pool.env(env).runMultiple(cmds, function(){
      log.info(pkg.name, 'done');
    });
  });

};

NodeOps.prototype.run = function( env, cmd ){

  var pool = this.pool;

  pool.env(env).sshRun([cmd], function(){
    log.info('run', 'done');
  });

};

NodeOps.prototype.tail = function(env, filePath, options){

  var pool = this.pool;

  var dowhat = (options.do || 'tail');

  if(!dowhat.match(/tail|cat/)) return log.error('do must be tail or cat');

  var cmd = 'sudo cat '+filePath;
  if( dowhat == 'tail'){
    cmd = 'sudo tail -f '+filePath;
  }

  pool.env(env).run(cmd,function(success, stream, stderr, server){
    stream.removeAllListeners('data');
    stream.on('data', function(data){
      data.toString().split('\n').forEach(function(line){
        if(line){
          console.log(server.name+' : '+line);
        }
      });

    });
  });
};

require('./extras/apache.js')(NodeOps);
require('./extras/app.js');
require('./extras/mysql.js');
require('./extras/newrelic.js');
require('./extras/php.js');
require('./extras/varnish.js');

module.exports = NodeOps;