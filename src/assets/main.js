var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;

//include the kami-specific AssetLoader
var AssetLoader = require('kami-assets');

//include polyfill for requestAnimationFrame
require('raf.js');

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(256, 256);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);
    
    //pass the context to the asset loader so it can be managed correctly 
    var assets = new AssetLoader(context);
    
    //add some DOM text
    var text = document.createElement("div");
    document.body.appendChild(text);

    //add some listeners...
    assets.loadStarted.add(function(ev) {
        text.innerHTML = "Load started";
    });
    assets.loadProgress.add(function(ev) {
        text.innerHTML = "Progress: "+ev.current + " / " + ev.total;
    });
    assets.loadFinished.add(function(ev) {
        text.innerHTML = "Load finished";
    })

    //These return a Texture object
    var scene = assets.add("img/scene.png");
    var grass = assets.add("img/grass.png");
    var guy   = assets.add("img/guy.png");
    grass.setFilter(Texture.Filter.LINEAR);
    //make the queue a bit longer...
    var tex = new Texture(context);
    for (var i=0; i<50; i++) {
        //we can specify a key, URL, and reusable Texture object to act on
        //We specify a filename so it can find the image loader easily
        assets.add("img"+i+".png", "img/grass.png", tex);
    }

    function render() {
        requestAnimationFrame(render);
        //get the GL rendering context
        var gl = context.gl;

        //clear canvas with opaque black
        gl.clearColor(0,0,0,1);
        gl.clear(gl.COLOR_BUFFER_BIT);            

        //this will start loading the next task on the queue,
        //and only returns true once all assets have finished loading
        if ( assets.update() ) {
            batch.begin();
            batch.draw(grass, 0, 0);
            batch.draw(guy, 25, 25, guy.width*2, guy.height*2);
            batch.end();
        } 
    }

    //Here we can simulate context loss / restore and how it plays with AssetLoader
    var loseCtx = context.gl.getExtension("WEBGL_lose_context");
    if (loseCtx) {
        var desc = document.createElement("div");
        desc.innerHTML = "Click the canvas to simulate context loss";
        document.body.appendChild(desc);

        context.view.addEventListener("mousedown", function() {
            loseCtx.loseContext();
            context.view.style.visibility = "hidden";
            text.style.visibility = "hidden";

            setTimeout(function() {
                context.view.style.visibility = "visible";
                text.style.visibility = "visible";
                loseCtx.restoreContext();
            }, 1000);
        }, true);
    }

    requestAnimationFrame(render);
});