//This is much cleaner than making a new grunt task for each demo. 

var browserify = require('browserify');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var demoList = require('./demo-index');

var template = fs.readFileSync( __dirname + '/src/template.html', 'utf8');

var defaults = {
    scripts: '',
};

demoList.forEach(function(demo) {
    if (!demo.path || !demo.name) {
        console.warn("No name/path spcified:", demo);
        return;
    }

    var b = browserify( demo.path );
    if (b.transform)
        b.transform( demo.transform );
    var out = path.join('release', 'js', demo.name+'.js');
    
    //fill in 'scripts' for those that don't need it..
    _.defaults(demo, defaults);

    //convert path to inline string
    if (demo.scripts) {
        demo.scripts = fs.readFileSync( demo.scripts, 'utf8' );
    }

    var htmlOut = path.join('release', demo.name+'.html');
    console.log("Writing", out + " and " + htmlOut);
    fs.writeFileSync( htmlOut, _.template(template, demo), 'utf8' );

    b.bundle( { debug: true } ).pipe(fs.createWriteStream( out ));
});