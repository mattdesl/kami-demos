var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;

var SpriteBatch = require('kami').SpriteBatch;
var FrameBuffer = require('kami').FrameBuffer;
var TextureRegion = require('kami').TextureRegion;
var ShaderProgram = require('kami').ShaderProgram;

//include polyfill for requestAnimationFrame
require('raf.js');

var fs = require('fs');

var AssetLoader = require('kami-assets');

var CompressedTexture = require('./CompressedTexture');
var CompressedTextureLoader = require('./CompressedTextureLoader');

domready(function() {
    //some example text
    var text = document.createElement("div");
    text.style.padding = "10px";
    text.innerHTML = "Loading...";
    document.body.appendChild(text);

    //create our WebGL context
    var context = new WebGLContext(512, 256);
    document.body.appendChild(context.view);

    var batch = new SpriteBatch(context);
        
    //we'll use an asset loader to ensure everything is loaded & renderable
    //before trying to draw it to the buffer.
    var assets = new AssetLoader(context);

    //register the plugin for this loader
    assets.registerLoader(CompressedTextureLoader);

    //Under the hood, we are using Brandon Jones' texture 
    //utils to support DDS, CRN and TGA. 
    var textures = [];
    textures.push( assets.add("img/test-dxt1.dds") );
    textures.push( assets.add("img/test-dxt1.crn") );
    textures.push( assets.add("img/test-dxt5.dds") );
    textures.push( assets.add("img/test-dxt5.crn") );
    textures.push( assets.add("img/test.tga") );

    /* 
       //We could also do this, if we don't want to use AssetLoader:
       var tex = new CompressedTexture(context, "img/test-dxt5.dds", function() {
           console.log("Texture loaded");
           requestAnimationFrame(render);
       });
    */
    
    //Add some text for load progress..
    assets.loadProgress.add(function(ev) {
        text.innerHTML = "Loading "+ev.current+" of "+ev.total;
    });

    assets.loadFinished.add(function(ev) {
        text.innerHTML = "Load complete";
    });

    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        //clear the screen
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (assets.update()) { //asset loading is complete
            batch.begin();
            
            //draw each texture, fit to the context width
            var sz = (context.width / textures.length);
            for (var i=0; i<textures.length; i++) {
                batch.draw(textures[i], i*sz, 0, sz, sz);
            }

            batch.end();
        }
    }

    requestAnimationFrame(render);
});