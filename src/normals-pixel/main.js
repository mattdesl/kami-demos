var domready = require('domready');

var WebGLContext = require('kami').WebGLContext;
var Texture = require('kami').Texture;
var SpriteBatch = require('kami').SpriteBatch;
var ShaderProgram = require('kami').ShaderProgram;
var FrameBuffer = require('kami').FrameBuffer;
var TextureRegion = require('kami').TextureRegion;

var AssetLoader = require('kami-assets');

var fs = require('fs');

//include polyfill for requestAnimationFrame
require('raf.js');

//Browserify rocks! We can inline our GLSL like so: (brfs transform)
var vert = fs.readFileSync( __dirname + "/lighting.vert" );
var frag = fs.readFileSync( __dirname + "/lighting.frag" );

function addCredits() { //.. I should probably include this in the HTML template
    var text = document.createElement("div");
    text.className = "credits";
    text.innerHTML = '<div><a href="https://github.com/mattdesl/kami-demos">kami-demos</a></div>'
                +'platformer art by <a href="http://opengameart.org/content/platformer-art-pixel-edition">Kenney</a>';
    document.body.appendChild(text);
}

var UPSCALE = 3;

domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(1024, 1024);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.background = "black";

    addCredits();

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);

    //Create our texture. When the diffuse is loaded, we can setup our FBO and start rendering
    var texNormal  = new Texture(context, "img/pixel-normals.png");
    var texDiffuse = new Texture(context, "img/pixel-diffuse.png", start);

    //the default light Z position
    var lightZ = 0.075,
        lightSize = 256; //So the light size is independent of canvas resolution

    //parameters for the lighting shader
    var ambientColor = new Float32Array([0.8, 0.8, 0.8, 0.3]);
    var lightColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
    var falloff = new Float32Array([0.4, 7.0, 30.0]);
    var lightPos = new Float32Array([0, 0, lightZ]);


    //setup our shader
    var shader = new ShaderProgram(context, vert, frag);
    if (shader.log)
        console.warn(shader.log);

    //notice how we bind our shader before setting uniforms!
    shader.bind();
    shader.setUniformi("u_normals", 1);
    shader.setUniformf("LightSize", lightSize);

    var fbo = null,
        fboRegion = null,
        mouseX = 0, 
        mouseY = -1, //make the light start off-screen
        scroll = 0,
        time   = 0;

    window.addEventListener("mousemove", function(ev) {
        if (!fbo)
            return;

        //Since we flipped the FBO region, we need to accomodate for that.
        //We also need to adjust for the amount we are scaling the FBO
        //This is because we use gl_FragCoord in the shader
        var w = fbo.width * UPSCALE;
        var h = fbo.height * UPSCALE;

        mouseX = ev.pageX / w;
        mouseY = (h - ev.pageY) / h;
        
    }, true);

    window.addEventListener("resize", function(ev) {
        context.resize(window.innerWidth, window.innerHeight);
    }, true);

    var lastTime = 0,
        now = Date.now();



    function start() {
        //We render our scene to a small buffer, and then up-scale it with nearest-neighbour
        //scaling. This should be faster since we aren't processing as many fragments with our
        //lighting shader.
        
        //We need to wait until the texture is loaded to determine its size.
        fbo = new FrameBuffer(context, texDiffuse.width, texDiffuse.height)
        
        //We now use a region to flip the texture coordinates, so it appears at top-left like normal
        fboRegion = new TextureRegion(fbo.texture);
        fboRegion.flip(false, true);

        requestAnimationFrame(render);
    }

    function drawScene(delta, buffer) {

        var texWidth = texDiffuse.width,
            texHeight = texDiffuse.height;

        // animate the camera by scrolling UV offsets
        time += 0.25 * delta;
        
        //we need to set the shader of our batch...
        batch.shader = shader;

        //We need to resize the batch to the size of the screen, in this case a FBO!
        batch.resize(buffer.width, buffer.height);

        //draw our image to the size of the canvas
        //this will bind our shader
        batch.begin();

        //the first light will be based on mouse
        lightPos[0] = mouseX;
        lightPos[1] = mouseY;

        //adjust the falloff a bit...
        falloff[2] = 30 - (Math.sin(time)/2+0.5)*15;

        //pass our parameters to the shader
        //Notice the resolution and light position are normalized to the WebGL canvas size
        shader.setUniformf("Resolution", fbo.width, fbo.height);
        shader.setUniformfv("AmbientColor", ambientColor);
        shader.setUniformfv("LightPos", lightPos);
        shader.setUniformfv("Falloff", falloff);
        shader.setUniformfv("LightColor", lightColor);

        texNormal.bind(1);  //bind normals to unit 1
        texDiffuse.bind(0); //bind diffuse to unit 0

        //Draw each sprite here...
        //You can use sprite sheets as long as diffuse & normals match
        batch.draw(texDiffuse, 0, 0, texWidth, texHeight);

        batch.end(); 
    }

    function render() {
        requestAnimationFrame(render);

        //get delta time for smooth animation
        now = Date.now();
        var delta = (now - lastTime) / 1000;
        lastTime = now;

        var gl = context.gl;

        //First, clear the main buffer (the screen)
        gl.clear(gl.COLOR_BUFFER_BIT);

        fbo.begin();

        //Now we need to clear the off-screen buffer!
        gl.clear(gl.COLOR_BUFFER_BIT);

        //draw the scene to our buffer
        drawScene(delta, fbo);

        fbo.end();

        //reset to default shader
        batch.shader = batch.defaultShader;

        //set the batch to the screen size
        batch.resize(context.width, context.height);

        //now we just draw it to the screen, upscaled
        batch.begin();
        batch.drawRegion(fboRegion, 0, 0, fbo.width * UPSCALE, fbo.height * UPSCALE)
        batch.end();
    }

});