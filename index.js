
var pkg = require('./package.json');
var SSH2pool = require('ssh2-pool');
var _ = require('underscore');
var async = require('async');
var path = require('path');
var glob = require('glob');
var fs = require('fs-extra');
var log = require('npmlog');

log.level = process.env['NPM_LOG'] || 'info';

var NodeOps = function(servers, profiles){
  this.profiles = profiles;
  this.servers = servers;
  this.pool = new SSH2pool(servers);
  this.log = log;
};

/**
 * Splits profile_env string
 * format is profile:env
 *
 * if env is null, such profile:
 * it will apply on all machine
 * it will use given profile
 *
 * if profile is null, such :env
 * it will apply on all machine of env
 * it will use first profile found
 *
 * @param profile_env
 * @returns {{profile: (*|null), env: string}}
 */
NodeOps.prototype.split_profile_env = function( profile_env ){

  profile_env = (''+profile_env);

  var profile = '';
  var env = '';

  if(profile_env.match(/^([^:]+):(.+)$/)){

    profile_env = profile_env.match(/^([^:]+):(.+)$/);

    profile = profile_env[1] || null;
    if( profile === null ){
      profile = Object.keys(this.profiles)[0];
    }

    env = (profile_env[2]) || ':all';

  } else if(profile_env.match(/.+/) ){
    profile = Object.keys(this.profiles)[0];

    env = profile_env;
  }

  if( !(profile in this.profiles) )
    throw 'profile '+profile+' does not exist.';

  if(!Object.keys(this.profiles).length)
    throw 'profile is required.';

  if(!(env in this.servers) && env !== ':all')
    throw 'env '+env+' does not exist.';

  return {
    profile: profile,
    env: env
  }
};

/**
 * Put a local directory to a remote path
 *
 * @param profile_env
 * @param localDirectoryPath
 * @param remotePath
 * @param options
 * @param done
 */
NodeOps.prototype.push = function( profile_env, localDirectoryPath, remotePath, options, done ){

  var env = this.split_profile_env(profile_env).env;

  var tmpRemotePath = options.tmp || '/tmp/'+(new Date()).getTime()+'';


  var pool = this.pool.env(env);

  var serverDone = 0;
  pool.putDir(localDirectoryPath, tmpRemotePath, function(){

    var cmds = function(){
      return [
        'sudo rm -fr '+remotePath+'',
        'sudo mkdir -p '+remotePath+'',
        'sudo cp -R '+tmpRemotePath+'/* '+remotePath+'',
        'sudo ls -alh '+remotePath+'/*',
        'msg:`All done!`'
      ]
    };
    pool.exec(cmds, function(err,stdout){
      serverDone++;
      if(pool.length===serverDone){
        log.info(pkg.name, 'done');
        setTimeout(function(){
          if(done) done(err,stdout);
        },500);
      }
    });
  });

};

/**
 * Run a command on a remote and return their outputs.
 *
 * @param profile_env
 * @param cmd
 * @param then
 */
NodeOps.prototype.exec = function( profile_env, cmd, then ){
  var env = this.split_profile_env(profile_env).env;
  var pool = this.pool;
  pool.env(env).exec([cmd], function(allSessionErr, allSessionText){
    log.info('run', 'done');
    if(then) then(allSessionErr, allSessionText);
  });
};

/**
 * Run a command on a remote and return their outputs.
 *
 * @param profile_env
 * @param cmd
 * @param then
 */
NodeOps.prototype.exec = function( profile_env, cmd, then ){
  var env = this.split_profile_env(profile_env).env;
  var pool = this.pool;
  pool.env(env).exec([cmd], function(allSessionErr, allSessionText){
    log.info('run', 'done');
    if(then) then(allSessionErr, allSessionText);
  });
};

/**
 * Run a command on a remote and return a close handler.
 * Ctrl+c would stop the process properly.
 *
 * @param profile_env
 * @param cmd
 * @param hostReady
 * @returns {Function}
 */
NodeOps.prototype.run = function( profile_env, cmd, hostReady ){
  var env = this.split_profile_env(profile_env).env;
  var pool = this.pool;
  var serie = [];
  pool.env(env).run(cmd, function(success, rstdout, rstderr, server, conn){
    serie.push(function(done){
      conn.end();
      done();
    });
    if(hostReady) hostReady(success, rstdout, rstderr, server, conn);
  });
  return function(done){
    async.parallelLimit(serie,4,done);
  };
};

/**
 *
 * @param profile_env
 * @param filePath
 * @param options
 * @param hostReady
 * @returns {*}
 */
NodeOps.prototype.tail = function(profile_env, filePath, options, hostReady){
  var env = this.split_profile_env(profile_env).env;

  if(_.isFunction(options)){
    hostReady = options;
    options = {};
  }

  var dowhat = (options.do || 'tail');

  if(!dowhat.match(/tail|cat/)) return log.error('do must be tail or cat');

  var cmd = 'sudo cat '+filePath;
  if( dowhat == 'tail'){
    cmd = 'sudo tail -f '+filePath;
  }

  return this.run(env, cmd, function(success, stream, stderr, server, conn){
    stream.on('data', function(data){
      data.toString().split('\n').forEach(function(line){
        if(line){
          console.log('%s@%s > %s',
            server.username, (server.name||server.host), line);
        }
      });
    });
    if(hostReady) hostReady(success, stream, stderr, server, conn);
  });
};

/**
 * Generate template files
 * and record their output
 * to a local directory.
 *
 * @param profile_env
 * @param sourcePath
 * @param savePath
 * @param done
 */
NodeOps.prototype.generate = function( profile_env, sourcePath, savePath, done ){

  profile_env = this.split_profile_env(profile_env);
  var env = profile_env.env;
  var profile = profile_env.profile;

  log.verbose(pkg.name, 'generate %s %s', sourcePath, savePath);

  var data = {
    servers:this.pool.env(env).toJson(),
    profile:this.profiles[profile],
    profileName:profile,
    // additional helper
    path:path
  };
  var options = {
    cwd: sourcePath
  };
  var fileDone = 0;
  options.nodir = true;
  glob( '**', options, function (er, files) {

    files.forEach(function(f){
      var from = path.join(sourcePath, f);
      var to = path.join(savePath, f);
      log.verbose(pkg.name, 'put %s %s', path.relative(sourcePath,from), path.relative(savePath,to));

      fs.readFile(from, function(err, template){
        try{
          var compiled = _.template(''+template);
          var result = compiled(data);
          fs.mkdirsSync(path.dirname(to));
          fs.writeFileSync(to,result,'utf-8');
        }catch(ex){
          log.error(pkg.name,ex);
        }
        fileDone++;
        if(files.length == fileDone ){
          setTimeout(function(){
            done();
          },500);
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