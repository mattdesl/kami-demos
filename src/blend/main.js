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

var vert = fs.readFileSync(__dirname + '/blend.vert');
var lighten = fs.readFileSync(__dirname + '/lighten.frag');
var darken = fs.readFileSync(__dirname + '/darken.frag');

domready(function() {
    var width = 256, height = 256;

    //create our WebGL context
    var context = new WebGLContext(width, height);
    document.body.appendChild(context.view);

    var batch = new SpriteBatch(context);
        
    //we'll use an asset loader to ensure everything is loaded & renderable
    //before trying to draw it to the buffer.
    var assets = new AssetLoader(context);

    var grass = assets.add("img/grass.png");
    var guy = assets.add("img/guy.png");

    var fboA = new FrameBuffer(context, width, height);
    var fboB = new FrameBuffer(context, width, height);

    //our little "scene graph"
    var sprites = [];
    //add the grass BG
    sprites.push({ x: 0, y: 0, width: width, height: height, texture: grass });

    var fboARegion = new TextureRegion(fboA.texture);
    fboARegion.flip(false, true);

    var fboBRegion = new TextureRegion(fboB.texture);
    
    var shaders = {
        'lighten': createBlendShader(lighten),
        'darken': createBlendShader(darken)
    };

    var count = 20;
    for (var i=0; i<count; i++) {
        sprites.push({ 
            x: Math.random()*width, 
            y: Math.random()*height, 
            width: 80,
            height: 80,
            texture: guy,
            blend: i > count/2 ? 'lighten' : 'darken'
        });
    }

    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        //clear the screen
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (assets.update()) { //asset loading is complete
            //rendering to first FBO
            fboA.begin();

            //clear the first buffer
            gl.clear(gl.COLOR_BUFFER_BIT);

            batch.begin();
            batch.shader = null;

            for (var i=0; i<sprites.length; i++) {
                var s = sprites[i];
                if (s.blend)
                    blendSprite(gl, s);
                else
                    batch.draw(s.texture, s.x, s.y, s.width, s.height);
            }

            batch.end();

            fboA.end();

            //draw the off-screen buffer to the screen..
            batch.begin();
            // batch.draw(fboA.texture)
            batch.drawRegion(fboARegion);
            batch.end();
        }
    }

    function createBlendShader(fragSrc) {
        var blendShader = new ShaderProgram(context, vert, fragSrc);
        blendShader.bind();
        blendShader.setUniformi("u_texture1", 1);
        blendShader.setUniformf("resolution", width, height);
        if (blendShader.log)
            console.warn(blendShader.log);
        return blendShader;
    }

    function blendSprite(gl, sprite) {
        //first we need to flush the batch to the GPU
        batch.flush();

        //now we need to un-bind our first FBO
        fboA.end();

        gl.finish();

        //bind our next FBO... we will render the back-buffer into this with blending
        fboB.begin();


        //clear the second buffer
        gl.clear(gl.COLOR_BUFFER_BIT);

        //grab our blend shader
        var shader = shaders[sprite.blend];
        batch.shader = shader;

        //bind our textures to the correct samplers
        fboA.texture.bind(1);
        sprite.texture.bind(0); 

        var w = sprite.width || sprite.texture.width;
        var h = sprite.height || sprite.texture.height;
        var x = sprite.x;
        var y = sprite.y;

        //draw the sprite into origin of FBO
        //but the origin is flipped...
        shader.setUniformf("bgOffset", x, y);
        batch.draw(sprite.texture, 0, height-h, w, h, 0, 1, 1, 0);
        batch.flush();
        fboB.end();

        fboA.begin();
        batch.shader = null;

        //now draw FBO b back to FBO A
        fboBRegion.setRegion(0, 0, w, h)
        batch.draw(fboB.texture, x, y);
        batch.flush();
    }

    requestAnimationFrame(render);
});