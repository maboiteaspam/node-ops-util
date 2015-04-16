var Apache = function(op){
  this.op = op;
};

Apache.prototype.reload = function(env){

  var pool = this.op.pool;

  var cmds = [
    'sudo httpd -t',
    'msg:`All done!`'
  ];

  var hasErrors = false;
  var checkSyntax = function(server, response){
    if(!hasErrors){
      hasErrors = !!response.match(/Syntax error/);
      if(hasErrors){
        log.error('apache_reload', "Syntax failed %s", server.ssh.host )
      }
    }
  };

  pool.env(env).exec(cmds, checkSyntax, function(){
    if(!hasErrors){
      var reload = [
        'sudo service httpd '+ (options.restart?'restart':'reload'),
        'sudo service httpd status',
        'msg:`All done!`'
      ];
      var checkRunning = function(server, response){
      };
      pool.env(env).exec(reload, checkRunning, function(){
        log.info('apache_reload', 'done');
      });
    }
  });
};

module.exports = Apache;
