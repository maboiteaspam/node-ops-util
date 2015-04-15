
var pkg = require('./package.json');
var SSH2pool = require('ssh2-pool');

var pool = new SSH2pool();

var NodeOps = function(){};

NodeOps.prototype.push = function( env, localPath, remotePath, tmpRemotePath ){

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

NodeOps.prototype.tail = function(env, filePath, options){

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

NodeOps.prototype.apache = require('./extras/apache.js');
NodeOps.prototype.app = require('./extras/app.js');
NodeOps.prototype.mysql = require('./extras/mysql.js');
NodeOps.prototype.newrelic = require('./extras/newrelic.js');
NodeOps.prototype.php = require('./extras/php.js');
NodeOps.prototype.varnish = require('./extras/varnish.js');

  module.exports = NodeOps;