
var program = require('commander');
var NodeOps = require('./index.js');

var servers = {};
var op = new NodeOps(servers);

// ----- httpd errors log tail or cat

program
  .command('httpd_errors <env>')
  .option('--do <what>', 'do tail or cat')
  .description('Tail or cat httpd error logs')
  .action(function(env, options){
    var filePath = '/var/log/httpd/{error,ssl_error}_log';
    op.tail(env, filePath, options);
  });

// ----- RUN raw command

program
  .command('run <env> <cmd>')
  .description('Run raw command on arbitrary server')
  .action(op.run);



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