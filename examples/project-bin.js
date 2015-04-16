
// An example of project binary that yu can build on top of this library.

var program = require('commander');
var NodeOps = require('../index.js');
var Apache = require('../extras/apache.js');

var servers = {};
var op = new NodeOps(servers);
var apache = new Apache(op);

// here you bind your needs accordingly to your project

// ----- httpd logs, tail or cat

program
  .command('httpd_access <env>')
  .option('--do <what>', 'do tail or cat')
  .description('Tail or cat httpd access logs')
  .action(function(env, options){
    var filePath = '/var/log/httpd/access_log';
    op.tail(env, filePath, options);
  });

program
  .command('httpd_errors <env>')
  .option('--do <what>', 'do tail or cat')
  .description('Tail or cat httpd error logs')
  .action(function(env, options){
    var filePath = '/var/log/httpd/{error,ssl_error}_log';
    op.tail(env, filePath, options);
  });

program
  .command('httpd_reload <env>')
  .description('Reload apache config')
  .option('--restart', 'Prefer restart')
  .action(apache.reload);

// ----- Push files

program
  .command('push <env> <localDirectoryPath> <remoteDirectoryPath>')
  .description('Push local directories to remote')
  .option('--tmp <remoteTmpPath>', 'Temporary path used to transfer the directory before it replaces the target')
  //.option('--exclude <pattern>', 'excludes some path')
  .action(op.push);

// ----- RUN raw command

program
  .command('run <env> <cmd>')
  .description('Run raw command on arbitrary server')
  .action(op.run);

// ----- Reload

console.log(op.reload)

// ----- HELP

program
  .command('*')
  .description('help')
  .action(function(){
    program.outputHelp();
  });


if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// ----- RUN

program.parse(process.argv);