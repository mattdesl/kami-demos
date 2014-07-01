(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
/*!
  * domready (c) Dustin Diaz 2012 - License MIT
  */
!function (name, definition) {
  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && typeof define.amd == 'object') define(definition)
  else this[name] = definition()
}('domready', function (ready) {

  var fns = [], fn, f = false
    , doc = document
    , testEl = doc.documentElement
    , hack = testEl.doScroll
    , domContentLoaded = 'DOMContentLoaded'
    , addEventListener = 'addEventListener'
    , onreadystatechange = 'onreadystatechange'
    , readyState = 'readyState'
    , loadedRgx = hack ? /^loaded|^c/ : /^loaded|c/
    , loaded = loadedRgx.test(doc[readyState])

  function flush(f) {
    loaded = 1
    while (f = fns.shift()) f()
  }

  doc[addEventListener] && doc[addEventListener](domContentLoaded, fn = function () {
    doc.removeEventListener(domContentLoaded, fn, f)
    flush()
  }, f)


  hack && doc.attachEvent(onreadystatechange, fn = function () {
    if (/^c/.test(doc[readyState])) {
      doc.detachEvent(onreadystatechange, fn)
      flush()
    }
  })

  return (ready = hack ?
    function (fn) {
      self != top ?
        loaded ? fn() : fns.push(fn) :
        function () {
          try {
            testEl.doScroll('left')
          } catch (e) {
            return setTimeout(function() { ready(fn) }, 50)
          }
          fn()
        }()
    } :
    function (fn) {
      loaded ? fn() : fns.push(fn)
    })
})

},{}],3:[function(require,module,exports){
/**
 * The core kami module provides basic 2D sprite batching and 
 * asset management.
 * 
 * @module kami
 */

var Class = require('klasse');
var Mesh = require('./glutils/Mesh');

var colorToFloat = require('number-util').colorToFloat;

/** 
 * A batcher mixin composed of quads (two tris, indexed). 
 *
 * This is used internally; users should look at 
 * {{#crossLink "SpriteBatch"}}{{/crossLink}} instead, which inherits from this
 * class.
 * 
 * The batcher itself is not managed by WebGLContext; however, it makes
 * use of Mesh and Texture which will be managed. For this reason, the batcher
 * does not hold a direct reference to the GL state.
 *
 * Subclasses must implement the following:  
 * {{#crossLink "BaseBatch/_createShader:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/_createVertexAttributes:method"}}{{/crossLink}}  
 * {{#crossLink "BaseBatch/getVertexSize:method"}}{{/crossLink}}  
 * 
 * @class  BaseBatch
 * @constructor
 * @param {WebGLContext} context the context this batcher belongs to
 * @param {Number} size the optional size of this batch, i.e. max number of quads
 * @default  500
 */
var BaseBatch = new Class({

	//Constructor
	initialize: function BaseBatch(context, size) {
		if (typeof context !== "object")
			throw "GL context not specified to SpriteBatch";
		this.context = context;

		this.size = size || 500;
		
		// 65535 is max index, so 65535 / 6 = 10922.
		if (this.size > 10922)  //(you'd have to be insane to try and batch this much with WebGL)
			throw "Can't have more than 10922 sprites per batch: " + this.size;
				
		
		
		this._blendSrc = this.context.gl.ONE;
		this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
		this._blendingEnabled = true;
		this._shader = this._createShader();

		/**
		 * This shader will be used whenever "null" is passed
		 * as the batch's shader. 
		 *
		 * @property {ShaderProgram} shader
		 */
		this.defaultShader = this._shader;

		/**
		 * By default, a SpriteBatch is created with its own ShaderProgram,
		 * stored in `defaultShader`. If this flag is true, on deleting the SpriteBatch, its
		 * `defaultShader` will also be deleted. If this flag is false, no shaders
		 * will be deleted on destroy.
		 *
		 * Note that if you re-assign `defaultShader`, you will need to dispose the previous
		 * default shader yoursel. 
		 *
		 * @property ownsShader
		 * @type {Boolean}
		 */
		this.ownsShader = true;

		this.idx = 0;

		/**
		 * Whether we are currently drawing to the batch. Do not modify.
		 * 
		 * @property {Boolean} drawing
		 */
		this.drawing = false;

		this.mesh = this._createMesh(this.size);


		/**
		 * The ABGR packed color, as a single float. The default
		 * value is the color white (255, 255, 255, 255).
		 *
		 * @property {Number} color
		 * @readOnly 
		 */
		this.color = colorToFloat(255, 255, 255, 255);
		
		/**
		 * Whether to premultiply alpha on calls to setColor. 
		 * This is true by default, so that we can conveniently write:
		 *
		 *     batch.setColor(1, 0, 0, 0.25); //tints red with 25% opacity
		 *
		 * If false, you must premultiply the colors yourself to achieve
		 * the same tint, like so:
		 *
		 *     batch.setColor(0.25, 0, 0, 0.25);
		 * 
		 * @property premultiplied
		 * @type {Boolean}
		 * @default  true
		 */
		this.premultiplied = true;
	},

	/**
	 * A property to enable or disable blending for this sprite batch. If
	 * we are currently drawing, this will first flush the batch, and then
	 * update GL_BLEND state (enabled or disabled) with our new value.
	 * 
	 * @property {Boolean} blendingEnabled
	 */
	blendingEnabled: {
		set: function(val) {
			var old = this._blendingEnabled;
			if (this.drawing)
				this.flush();

			this._blendingEnabled = val;

			//if we have a new value, update it.
			//this is because blend is done in begin() / end() 
			if (this.drawing && old != val) {
				var gl = this.context.gl;
				if (val)
					gl.enable(gl.BLEND);
				else
					gl.disable(gl.BLEND);
			}

		},

		get: function() {
			return this._blendingEnabled;
		}
	},

	/**
	 * Sets the blend source parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 * 
	 * @property {GLenum} blendDst 
	 */
	blendSrc: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendSrc = val;
		},

		get: function() {
			return this._blendSrc;
		}
	},

	/**
	 * Sets the blend destination parameters. 
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either src or dst to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @property {GLenum} blendSrc 
	 */
	blendDst: {
		set: function(val) {
			if (this.drawing)
				this.flush();
			this._blendDst = val;
		},

		get: function() {
			return this._blendDst;
		}
	},

	/**
	 * Sets the blend source and destination parameters. This is 
	 * a convenience function for the blendSrc and blendDst setters.
	 * If we are currently drawing, this will flush the batch.
	 *
	 * Setting either to `null` or a falsy value tells the SpriteBatch
	 * to ignore gl.blendFunc. This is useful if you wish to use your
	 * own blendFunc or blendFuncSeparate. 
	 *
	 * @method  setBlendFunction
	 * @param {GLenum} blendSrc the source blend parameter
	 * @param {GLenum} blendDst the destination blend parameter
	 */
	setBlendFunction: function(blendSrc, blendDst) {
		this.blendSrc = blendSrc;
		this.blendDst = blendDst;
	},

	/**
	 * This is a setter/getter for this batch's current ShaderProgram.
	 * If this is set when the batch is drawing, the state will be flushed
	 * to the GPU and the new shader will then be bound.
	 *
	 * If `null` or a falsy value is specified, the batch's `defaultShader` will be used. 
	 *
	 * Note that shaders are bound on batch.begin().
	 *
	 * @property shader
	 * @type {ShaderProgram}
	 */
	shader: {
		set: function(val) {
			var wasDrawing = this.drawing;

			if (wasDrawing) {
				this.end(); //unbinds the shader from the mesh
			}

			this._shader = val ? val : this.defaultShader;

			if (wasDrawing) {
				this.begin();
			}
		},

		get: function() {
			return this._shader;
		}
	},

	/**
	 * Sets the color of this sprite batcher, which is used in subsequent draw
	 * calls. This does not flush the batch.
	 *
	 * If r, g, b, are all numbers, this method assumes that RGB 
	 * or RGBA float values (0.0 to 1.0) are being passed. Alpha defaults to one
	 * if undefined.
	 * 
	 * If the first three arguments are not numbers, we only consider the first argument
	 * and assign it to all four components -- this is useful for setting transparency 
	 * in a premultiplied alpha stage. 
	 * 
	 * If the first argument is invalid or not a number,
	 * the color defaults to (1, 1, 1, 1).
	 *
	 * @method  setColor
	 * @param {Number} r the red component, normalized
	 * @param {Number} g the green component, normalized
	 * @param {Number} b the blue component, normalized
	 * @param {Number} a the alpha component, normalized
	 */
	setColor: function(r, g, b, a) {
		var rnum = typeof r === "number";
		if (rnum
				&& typeof g === "number"
				&& typeof b === "number") {
			//default alpha to one 
			a = (a || a === 0) ? a : 1.0;
		} else {
			r = g = b = a = rnum ? r : 1.0;
		}
		
		if (this.premultiplied) {
			r *= a;
			g *= a;
			b *= a;
		}
		
		this.color = colorToFloat(
			~~(r * 255),
			~~(g * 255),
			~~(b * 255),
			~~(a * 255)
		);
	},

	/**
	 * Called from the constructor to create a new Mesh 
	 * based on the expected batch size. Should set up
	 * verts & indices properly.
	 *
	 * Users should not call this directly; instead, it
	 * should only be implemented by subclasses.
	 * 
	 * @method _createMesh
	 * @param {Number} size the size passed through the constructor
	 */
	_createMesh: function(size) {
		//the total number of floats in our batch
		var numVerts = size * 4 * this.getVertexSize();
		//the total number of indices in our batch
		var numIndices = size * 6;
		var gl = this.context.gl;

		//vertex data
		this.vertices = new Float32Array(numVerts);
		//index data
		this.indices = new Uint16Array(numIndices); 
		
		for (var i=0, j=0; i < numIndices; i += 6, j += 4) 
		{
			this.indices[i + 0] = j + 0; 
			this.indices[i + 1] = j + 1;
			this.indices[i + 2] = j + 2;
			this.indices[i + 3] = j + 0;
			this.indices[i + 4] = j + 2;
			this.indices[i + 5] = j + 3;
		}

		var mesh = new Mesh(this.context, false, 
						numVerts, numIndices, this._createVertexAttributes());
		mesh.vertices = this.vertices;
		mesh.indices = this.indices;
		mesh.vertexUsage = gl.DYNAMIC_DRAW;
		mesh.indexUsage = gl.STATIC_DRAW;
		mesh.dirty = true;
		return mesh;
	},

	/**
	 * Returns a shader for this batch. If you plan to support
	 * multiple instances of your batch, it may or may not be wise
	 * to use a shared shader to save resources.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  _createShader
	 * @return {Number} the size of a vertex, in # of floats
	 */
	_createShader: function() {
		throw "_createShader not implemented"
	},	

	/**
	 * Returns an array of vertex attributes for this mesh; 
	 * subclasses should implement this with the attributes 
	 * expected for their batch.
	 *
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method _createVertexAttributes
	 * @return {Array} an array of Mesh.VertexAttrib objects
	 */
	_createVertexAttributes: function() {
		throw "_createVertexAttributes not implemented";
	},


	/**
	 * Returns the number of floats per vertex for this batcher.
	 * 
	 * This method initially throws an error; so it must be overridden by
	 * subclasses of BaseBatch.
	 *
	 * @method  getVertexSize
	 * @return {Number} the size of a vertex, in # of floats
	 */
	getVertexSize: function() {
		throw "getVertexSize not implemented";
	},

	
	/** 
	 * Begins the sprite batch. This will bind the shader
	 * and mesh. Subclasses may want to disable depth or 
	 * set up blending.
	 *
	 * @method  begin
	 */
	begin: function()  {
		if (this.drawing) 
			throw "batch.end() must be called before begin";
		this.drawing = true;

		this.shader.bind();

		//bind the attributes now to avoid redundant calls
		this.mesh.bind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.enable(gl.BLEND);
		}
	},

	/** 
	 * Ends the sprite batch. This will flush any remaining 
	 * data and set GL state back to normal.
	 * 
	 * @method  end
	 */
	end: function()  {
		if (!this.drawing)
			throw "batch.begin() must be called before end";
		if (this.idx > 0)
			this.flush();
		this.drawing = false;

		this.mesh.unbind(this.shader);

		if (this._blendingEnabled) {
			var gl = this.context.gl;
			gl.disable(gl.BLEND);
		}
	},

	/** 
	 * Called before rendering to bind new textures.
	 * This method does nothing by default.
	 *
	 * @method  _preRender
	 */
	_preRender: function()  {
	},

	/**
	 * Flushes the batch by pushing the current data
	 * to GL.
	 * 
	 * @method flush
	 */
	flush: function()  {
		if (this.idx===0)
			return;

		var gl = this.context.gl;

		//premultiplied alpha
		if (this._blendingEnabled) {
			//set either to null if you want to call your own 
			//blendFunc or blendFuncSeparate
			if (this._blendSrc && this._blendDst)
				gl.blendFunc(this._blendSrc, this._blendDst); 
		}

		this._preRender();

		//number of sprites in batch
		var numComponents = this.getVertexSize();
		var spriteCount = (this.idx / (numComponents * 4));
		
		//draw the sprites
		this.mesh.verticesDirty = true;
		this.mesh.draw(gl.TRIANGLES, spriteCount * 6, 0, this.idx);

		this.idx = 0;
	},

	/**
	 * Adds a sprite to this batch.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method draw
	 * @param  {Texture} texture the texture for this sprite
	 * @param  {Number} x       the x position, defaults to zero
	 * @param  {Number} y       the y position, defaults to zero
	 * @param  {Number} width   the width, defaults to the texture width
	 * @param  {Number} height  the height, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices.
	 * The specifics depend on the sprite batch implementation.
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the texture we are drawing for this sprite
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off)  {
	},

	drawRegion: function(region, x, y, width, height) {
		this.draw(region.texture, x, y, width, height, region.u, region.v, region.u2, region.v2);
	},

	/**
	 * Destroys the batch, deleting its buffers and removing it from the
	 * WebGLContext management. Trying to use this
	 * batch after destroying it can lead to unpredictable behaviour.
	 *
	 * If `ownsShader` is true, this will also delete the `defaultShader` object.
	 * 
	 * @method destroy
	 */
	destroy: function() {
		this.vertices = null;
		this.indices = null;
		this.size = this.maxVertices = 0;

		if (this.ownsShader && this.defaultShader)
			this.defaultShader.destroy();
		this.defaultShader = null;
		this._shader = null; // remove reference to whatever shader is currently being used

		if (this.mesh) 
			this.mesh.destroy();
		this.mesh = null;
	}
});

module.exports = BaseBatch;

},{"./glutils/Mesh":9,"klasse":14,"number-util":12}],4:[function(require,module,exports){
/**
 * @module kami
 */

// Requires....
var Class         = require('klasse');

var BaseBatch = require('./BaseBatch');

var Mesh          = require('./glutils/Mesh');
var ShaderProgram = require('./glutils/ShaderProgram');

/**
 * A basic implementation of a batcher which draws 2D sprites.
 * This uses two triangles (quads) with indexed and interleaved
 * vertex data. Each vertex holds 5 floats (Position.xy, Color, TexCoord0.xy).
 *
 * The color is packed into a single float to reduce vertex bandwidth, and
 * the data is interleaved for best performance. We use a static index buffer,
 * and a dynamic vertex buffer that is updated with bufferSubData. 
 * 
 * @example
 *      var SpriteBatch = require('kami').SpriteBatch;  
 *      
 *      //create a new batcher
 *      var batch = new SpriteBatch(context);
 *
 *      function render() {
 *          batch.begin();
 *          
 *          //draw some sprites in between begin and end...
 *          batch.draw( texture, 0, 0, 25, 32 );
 *          batch.draw( texture1, 0, 25, 42, 23 );
 * 
 *          batch.end();
 *      }
 * 
 * @class  SpriteBatch
 * @uses BaseBatch
 * @constructor
 * @param {WebGLContext} context the context for this batch
 * @param {Number} size the max number of sprites to fit in a single batch
 */
var SpriteBatch = new Class({

	//inherit some stuff onto this prototype
	Mixins: BaseBatch,

	//Constructor
	initialize: function SpriteBatch(context, size) {
		BaseBatch.call(this, context, size);

		/**
		 * The projection Float32Array vec2 which is
		 * used to avoid some matrix calculations.
		 *
		 * @property projection
		 * @type {Float32Array}
		 */
		this.projection = new Float32Array(2);

		//Sets up a default projection vector so that the batch works without setProjection
		this.projection[0] = this.context.width/2;
		this.projection[1] = this.context.height/2;

		/**
		 * The currently bound texture. Do not modify.
		 * 
		 * @property {Texture} texture
		 * @readOnly
		 */
		this.texture = null;
	},

	/**
	 * This is a convenience function to set the batch's projection
	 * matrix to an orthographic 2D projection, based on the given screen
	 * size. This allows users to render in 2D without any need for a camera.
	 * 
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @return {[type]}        [description]
	 */
	resize: function(width, height) {
		this.setProjection(width/2, height/2);
	},

	/**
	 * The number of floats per vertex for this batcher 
	 * (Position.xy + Color + TexCoord0.xy).
	 *
	 * @method  getVertexSize
	 * @return {Number} the number of floats per vertex
	 */
	getVertexSize: function() {
		return SpriteBatch.VERTEX_SIZE;
	},

	/**
	 * Used internally to return the Position, Color, and TexCoord0 attributes.
	 *
	 * @method  _createVertexAttribuets
	 * @protected
	 * @return {[type]} [description]
	 */
	_createVertexAttributes: function() {
		var gl = this.context.gl;

		return [ 
			new Mesh.Attrib(ShaderProgram.POSITION_ATTRIBUTE, 2),
			 //pack the color using some crazy wizardry 
			new Mesh.Attrib(ShaderProgram.COLOR_ATTRIBUTE, 4, null, gl.UNSIGNED_BYTE, true, 1),
			new Mesh.Attrib(ShaderProgram.TEXCOORD_ATTRIBUTE+"0", 2)
		];
	},


	/**
	 * Sets the projection vector, an x and y
	 * defining the middle points of your stage.
	 *
	 * @method setProjection
	 * @param {Number} x the x projection value
	 * @param {Number} y the y projection value
	 */
	setProjection: function(x, y) {
		var oldX = this.projection[0];
		var oldY = this.projection[1];
		this.projection[0] = x;
		this.projection[1] = y;

		//we need to flush the batch..
		if (this.drawing && (x != oldX || y != oldY)) {
			this.flush();
			this._updateMatrices();
		}
	},

	/**
	 * Creates a default shader for this batch.
	 *
	 * @method  _createShader
	 * @protected
	 * @return {ShaderProgram} a new instance of ShaderProgram
	 */
	_createShader: function() {
		var shader = new ShaderProgram(this.context,
				SpriteBatch.DEFAULT_VERT_SHADER, 
				SpriteBatch.DEFAULT_FRAG_SHADER);
		if (shader.log)
			console.warn("Shader Log:\n" + shader.log);
		return shader;
	},

	/**
	 * This is called during rendering to update projection/transform
	 * matrices and upload the new values to the shader. For example,
	 * if the user calls setProjection mid-draw, the batch will flush
	 * and this will be called before continuing to add items to the batch.
	 *
	 * You generally should not need to call this directly.
	 * 
	 * @method  updateMatrices
	 * @protected
	 */
	updateMatrices: function() {
		this.shader.setUniformfv("u_projection", this.projection);
	},

	/**
	 * Called before rendering, and binds the current texture.
	 * 
	 * @method _preRender
	 * @protected
	 */
	_preRender: function() {
		if (this.texture)
			this.texture.bind();
	},

	/**
	 * Binds the shader, disables depth writing, 
	 * enables blending, activates texture unit 0, and sends
	 * default matrices and sampler2D uniforms to the shader.
	 *
	 * @method  begin
	 */
	begin: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//This binds the shader and mesh!
		BaseBatch.prototype.begin.call(this);

		this.updateMatrices(); //send projection/transform to shader

		//upload the sampler uniform. not necessary every flush so we just
		//do it here.
		this.shader.setUniformi("u_texture0", 0);

		//disable depth mask
		gl.depthMask(false);
	},

	/**
	 * Ends the sprite batcher and flushes any remaining data to the GPU.
	 * 
	 * @method end
	 */
	end: function() {
		//sprite batch doesn't hold a reference to GL since it is volatile
		var gl = this.context.gl;
		
		//just do direct parent call for speed here
		//This binds the shader and mesh!
		BaseBatch.prototype.end.call(this);

		gl.depthMask(true);
	},

	/**
	 * Flushes the batch to the GPU. This should be called when
	 * state changes, such as blend functions, depth or stencil states,
	 * shaders, and so forth.
	 * 
	 * @method flush
	 */
	flush: function() {
		//ignore flush if texture is null or our batch is empty
		if (!this.texture)
			return;
		if (this.idx === 0)
			return;
		BaseBatch.prototype.flush.call(this);
		SpriteBatch.totalRenderCalls++;
	},

	/**
	 * Adds a sprite to this batch. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 * 
	 * @method draw
	 * @param  {Texture} texture the Texture
	 * @param  {Number} x       the x position in pixels, defaults to zero
	 * @param  {Number} y       the y position in pixels, defaults to zero
	 * @param  {Number} width   the width in pixels, defaults to the texture width
	 * @param  {Number} height  the height in pixels, defaults to the texture height
	 * @param  {Number} u1      the first U coordinate, default zero
	 * @param  {Number} v1      the first V coordinate, default zero
	 * @param  {Number} u2      the second U coordinate, default one
	 * @param  {Number} v2      the second V coordinate, default one
	 */
	draw: function(texture, x, y, width, height, u1, v1, u2, v2) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";

		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;

		if (this.texture === null || this.texture.id !== texture.id) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		width = (width===0) ? width : (width || texture.width);
		height = (height===0) ? height : (height || texture.height);
		x = x || 0;
		y = y || 0;

		var x1 = x;
		var x2 = x + width;
		var y1 = y;
		var y2 = y + height;

		u1 = u1 || 0;
		u2 = (u2===0) ? u2 : (u2 || 1);
		v1 = v1 || 0;
		v2 = (v2===0) ? v2 : (v2 || 1);

		var c = this.color;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v1;
		
		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y1;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v1;

		//xy
		this.vertices[this.idx++] = x2;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u2;
		this.vertices[this.idx++] = v2;

		//xy
		this.vertices[this.idx++] = x1;
		this.vertices[this.idx++] = y2;
		//color
		this.vertices[this.idx++] = c;
		//uv
		this.vertices[this.idx++] = u1;
		this.vertices[this.idx++] = v2;
	},

	/**
	 * Adds a single quad mesh to this sprite batch from the given
	 * array of vertices. The sprite is drawn in 
	 * screen-space with the origin at the upper-left corner (y-down).
	 *
	 * This reads 20 interleaved floats from the given offset index, in the format
	 *
	 *  { x, y, color, u, v,
	 *      ...  }
	 *
	 * @method  drawVertices
	 * @param {Texture} texture the Texture object
	 * @param {Float32Array} verts an array of vertices
	 * @param {Number} off the offset into the vertices array to read from
	 */
	drawVertices: function(texture, verts, off) {
		if (!this.drawing)
			throw "Illegal State: trying to draw a batch before begin()";
		
		//don't draw anything if GL tex doesn't exist..
		if (!texture)
			return;


		if (this.texture != texture) {
			//new texture.. flush previous data
			this.flush();
			this.texture = texture;
		} else if (this.idx == this.vertices.length) {
			this.flush(); //we've reached our max, flush before pushing more data
		}

		off = off || 0;
		//TODO: use a loop here?
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		
		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];

		//xy
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
		//color
		this.vertices[this.idx++] = verts[off++];
		//uv
		this.vertices[this.idx++] = verts[off++];
		this.vertices[this.idx++] = verts[off++];
	}
});

/**
 * The default vertex size, i.e. number of floats per vertex.
 * @attribute  VERTEX_SIZE
 * @static
 * @final
 * @type {Number}
 * @default  5
 */
SpriteBatch.VERTEX_SIZE = 5;

/**
 * Incremented after each draw call, can be used for debugging.
 *
 *     SpriteBatch.totalRenderCalls = 0;
 *
 *     ... draw your scene ...
 *
 *     console.log("Draw calls per frame:", SpriteBatch.totalRenderCalls);
 *
 * 
 * @attribute  totalRenderCalls
 * @static
 * @type {Number}
 * @default  0
 */
SpriteBatch.totalRenderCalls = 0;

SpriteBatch.DEFAULT_FRAG_SHADER = [
	"precision mediump float;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",
	"uniform sampler2D u_texture0;",

	"void main(void) {",
	"   gl_FragColor = texture2D(u_texture0, vTexCoord0) * vColor;",
	"}"
].join('\n');

SpriteBatch.DEFAULT_VERT_SHADER = [
	"attribute vec2 "+ShaderProgram.POSITION_ATTRIBUTE+";",
	"attribute vec4 "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"attribute vec2 "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",

	"uniform vec2 u_projection;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",

	"void main(void) {", ///TODO: use a projection and transform matrix
	"   gl_Position = vec4( "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".x / u_projection.x - 1.0, "
		+ShaderProgram.POSITION_ATTRIBUTE
		+".y / -u_projection.y + 1.0 , 0.0, 1.0);",
	"   vTexCoord0 = "+ShaderProgram.TEXCOORD_ATTRIBUTE+"0;",
	"   vColor = "+ShaderProgram.COLOR_ATTRIBUTE+";",
	"}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":3,"./glutils/Mesh":9,"./glutils/ShaderProgram":10,"klasse":14}],5:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');
var nextPowerOfTwo = require('number-util').nextPowerOfTwo;
var isPowerOfTwo = require('number-util').isPowerOfTwo;

var Texture = new Class({


	/**
	 * Creates a new texture with the optional width, height, and data.
	 *
	 * If the constructor is passed no parameters other than WebGLContext, then
	 * it will not be initialized and will be non-renderable. You will need to manually
	 * uploadData or uploadImage yourself.
	 *
	 * If you pass a width and height after context, the texture will be initialized with that size
	 * and null data (e.g. transparent black). If you also pass the format and data, 
	 * it will be uploaded to the texture. 
	 *
	 * If you pass a String or Data URI as the second parameter,
	 * this Texture will load an Image object asynchronously. The optional third
	 * and fourth parameters are callback functions for success and failure, respectively. 
	 * The optional fifrth parameter for this version of the constructor is genMipmaps, which defaults to false. 
	 * 
	 * The arguments are kept in memory for future context restoration events. If
	 * this is undesirable (e.g. huge buffers which need to be GC'd), you should not
	 * pass the data in the constructor, but instead upload it after creating an uninitialized 
	 * texture. You will need to manage it yourself, either by extending the create() method, 
	 * or listening to restored events in WebGLContext.
	 *
	 * Most users will want to use the AssetManager to create and manage their textures
	 * with asynchronous loading and context loss. 
	 *
	 * @example
	 * 		new Texture(context, 256, 256); //empty 256x256 texture
	 * 		new Texture(context, 1, 1, Texture.Format.RGBA, Texture.DataType.UNSIGNED_BYTE, 
	 * 					new Uint8Array([255,0,0,255])); //1x1 red texture
	 * 		new Texture(context, "test.png"); //loads image asynchronously
	 * 		new Texture(context, "test.png", successFunc, failFunc, useMipmaps); //extra params for image laoder 
	 *
	 * @class  Texture
	 * @constructor
	 * @param  {WebGLContext} context the WebGL context
	 * @param  {Number} width the width of this texture
	 * @param  {Number} height the height of this texture
	 * @param  {GLenum} format e.g. Texture.Format.RGBA
	 * @param  {GLenum} dataType e.g. Texture.DataType.UNSIGNED_BYTE (Uint8Array)
	 * @param  {GLenum} data the array buffer, e.g. a Uint8Array view
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data
	 */
	initialize: function Texture(context, width, height, format, dataType, data, genMipmaps) {
		if (typeof context !== "object")
			throw "GL context not specified to Texture";
		this.context = context;

		/**
		 * The WebGLTexture which backs this Texture object. This
		 * can be used for low-level GL calls.
		 * 
		 * @type {WebGLTexture}
		 */
		this.id = null; //initialized in create()

		/**
		 * The target for this texture unit, i.e. TEXTURE_2D. Subclasses
		 * should override the create() method to change this, for correct
		 * usage with context restore.
		 * 
		 * @property target
		 * @type {GLenum}
		 * @default  gl.TEXTURE_2D
		 */
		this.target = context.gl.TEXTURE_2D;

		/**
		 * The width of this texture, in pixels.
		 * 
		 * @property width
		 * @readOnly
		 * @type {Number} the width
		 */
		this.width = 0; //initialized on texture upload

		/**
		 * The height of this texture, in pixels.
		 * 
		 * @property height
		 * @readOnly
		 * @type {Number} the height
		 */
		this.height = 0; //initialized on texture upload

		// e.g. --> new Texture(gl, 256, 256, gl.RGB, gl.UNSIGNED_BYTE, data);
		//		      creates a new empty texture, 256x256
		//		--> new Texture(gl);
		//			  creates a new texture but WITHOUT uploading any data. 

		/**
		 * The S wrap parameter.
		 * @property {GLenum} wrapS
		 */
		this.wrapS = Texture.DEFAULT_WRAP;
		/**
		 * The T wrap parameter.
		 * @property {GLenum} wrapT
		 */
		this.wrapT = Texture.DEFAULT_WRAP;
		/**
		 * The minifcation filter.
		 * @property {GLenum} minFilter 
		 */
		this.minFilter = Texture.DEFAULT_FILTER;
		
		/**
		 * The magnification filter.
		 * @property {GLenum} magFilter 
		 */
		this.magFilter = Texture.DEFAULT_FILTER;

		/**
		 * When a texture is created, we keep track of the arguments provided to 
		 * its constructor. On context loss and restore, these arguments are re-supplied
		 * to the Texture, so as to re-create it in its correct form.
		 *
		 * This is mainly useful if you are procedurally creating textures and passing
		 * their data directly (e.g. for generic lookup tables in a shader). For image
		 * or media based textures, it would be better to use an AssetManager to manage
		 * the asynchronous texture upload.
		 *
		 * Upon destroying a texture, a reference to this is also lost.
		 *
		 * @property managedArgs
		 * @type {Array} the array of arguments, shifted to exclude the WebGLContext parameter
		 */
		this.managedArgs = Array.prototype.slice.call(arguments, 1);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * This can be called after creating a Texture to load an Image object asynchronously,
	 * or upload image data directly. It takes the same parameters as the constructor, except 
	 * for the context which has already been established. 
	 *
	 * Users will generally not need to call this directly. 
	 * 
	 * @protected
	 * @method  setup
	 */
	setup: function(width, height, format, dataType, data, genMipmaps) {
		var gl = this.gl;

		//If the first argument is a string, assume it's an Image loader
		//second argument will then be genMipmaps, third and fourth the success/fail callbacks
		if (typeof width === "string") {
			var img = new Image();
			var path      = arguments[0];   //first argument, the path
			var successCB = typeof arguments[1] === "function" ? arguments[1] : null;
			var failCB    = typeof arguments[2] === "function" ? arguments[2] : null;
			genMipmaps    = !!arguments[3];

			var self = this;

			//If you try to render a texture that is not yet "renderable" (i.e. the 
			//async load hasn't completed yet, which is always the case in Chrome since requestAnimationFrame
			//fires before img.onload), WebGL will throw us errors. So instead we will just upload some
			//dummy data until the texture load is complete. Users can disable this with the global flag.
			if (Texture.USE_DUMMY_1x1_DATA) {
				self.uploadData(1, 1);
				this.width = this.height = 0;
			}

			img.onload = function() {
				self.uploadImage(img, undefined, undefined, genMipmaps);
				if (successCB)
					successCB();
			}
			img.onerror = function() {
				// console.warn("Error loading image: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}
			img.onabort = function() {
				// console.warn("Image load aborted: "+path);
				if (genMipmaps) //we still need to gen mipmaps on the 1x1 dummy
					gl.generateMipmap(gl.TEXTURE_2D);
				if (failCB)
					failCB();
			}

			img.src = path;
		} 
		//otherwise assume our regular list of width/height arguments are passed
		else {
			this.uploadData(width, height, format, dataType, data, genMipmaps);
		}
	},	

	/**
	 * Called in the Texture constructor, and after the GL context has been re-initialized. 
	 * Subclasses can override this to provide a custom data upload, e.g. cubemaps or compressed
	 * textures.
	 *
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		this.id = gl.createTexture(); //texture ID is recreated
		this.width = this.height = 0; //size is reset to zero until loaded
		this.target = gl.TEXTURE_2D;  //the provider can change this if necessary (e.g. cube maps)

		this.bind();


		//TODO: clean these up a little. 
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, Texture.UNPACK_PREMULTIPLY_ALPHA);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, Texture.UNPACK_ALIGNMENT);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, Texture.UNPACK_FLIP_Y);
		
		var colorspace = Texture.UNPACK_COLORSPACE_CONVERSION || gl.BROWSER_DEFAULT_WEBGL;
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, colorspace);

		//setup wrap modes without binding redundantly
		this.setWrap(this.wrapS, this.wrapT, false);
		this.setFilter(this.minFilter, this.magFilter, false);
		
		if (this.managedArgs.length !== 0) {
			this.setup.apply(this, this.managedArgs);
		}
	},

	/**
	 * Destroys this texture by deleting the GL resource,
	 * removing it from the WebGLContext management stack,
	 * setting its size to zero, and id and managed arguments to null.
	 * 
	 * Trying to use this texture after may lead to undefined behaviour.
	 *
	 * @method  destroy
	 */
	destroy: function() {
		if (this.id && this.gl)
			this.gl.deleteTexture(this.id);
		if (this.context)
			this.context.removeManagedObject(this);
		this.width = this.height = 0;
		this.id = null;
		this.managedArgs = null;
		this.context = null;
		this.gl = null;
	},

	/**
	 * Sets the wrap mode for this texture; if the second argument
	 * is undefined or falsy, then both S and T wrap will use the first
	 * argument.
	 *
	 * You can use Texture.Wrap constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setWrap
	 * @param {GLenum} s the S wrap mode
	 * @param {GLenum} t the T wrap mode
	 * @param {Boolean} ignoreBind (optional) if true, the bind will be ignored. 
	 */
	setWrap: function(s, t, ignoreBind) { //TODO: support R wrap mode
		if (s && t) {
			this.wrapS = s;
			this.wrapT = t;
		} else 
			this.wrapS = this.wrapT = s;
		
		//enforce POT rules..
		this._checkPOT();	

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_S, this.wrapS);
		gl.texParameteri(this.target, gl.TEXTURE_WRAP_T, this.wrapT);
	},


	/**
	 * Sets the min and mag filter for this texture; 
	 * if mag is undefined or falsy, then both min and mag will use the
	 * filter specified for min.
	 *
	 * You can use Texture.Filter constants for convenience, to avoid needing 
	 * a GL reference.
	 *
	 * @method  setFilter
	 * @param {GLenum} min the minification filter
	 * @param {GLenum} mag the magnification filter
	 * @param {Boolean} ignoreBind if true, the bind will be ignored. 
	 */
	setFilter: function(min, mag, ignoreBind) { 
		if (min && mag) {
			this.minFilter = min;
			this.magFilter = mag;
		} else 
			this.minFilter = this.magFilter = min;
		
		//enforce POT rules..
		this._checkPOT();

		if (!ignoreBind)
			this.bind();

		var gl = this.gl;
		gl.texParameteri(this.target, gl.TEXTURE_MIN_FILTER, this.minFilter);
		gl.texParameteri(this.target, gl.TEXTURE_MAG_FILTER, this.magFilter);
	},

	/**
	 * A low-level method to upload the specified ArrayBufferView
	 * to this texture. This will cause the width and height of this
	 * texture to change.
	 *
	 * @method  uploadData
	 * @param  {Number} width          the new width of this texture,
	 *                                 defaults to the last used width (or zero)
	 * @param  {Number} height         the new height of this texture
	 *                                 defaults to the last used height (or zero)
	 * @param  {GLenum} format         the data format, default RGBA
	 * @param  {GLenum} type           the data type, default UNSIGNED_BYTE (Uint8Array)
	 * @param  {ArrayBufferView} data  the raw data for this texture, or null for an empty image
	 * @param  {Boolean} genMipmaps	   whether to generate mipmaps after uploading the data, default false
	 */
	uploadData: function(width, height, format, type, data, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		data = data || null; //make sure falsey value is null for texImage2D

		this.width = (width || width==0) ? width : this.width;
		this.height = (height || height==0) ? height : this.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, 
					  this.width, this.height, 0, format,
					  type, data);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * Uploads ImageData, HTMLImageElement, HTMLCanvasElement or 
	 * HTMLVideoElement.
	 *
	 * @method  uploadImage
	 * @param  {Object} domObject the DOM image container
	 * @param  {GLenum} format the format, default gl.RGBA
	 * @param  {GLenum} type the data type, default gl.UNSIGNED_BYTE
	 * @param  {Boolean} genMipmaps whether to generate mipmaps after uploading the data, default false
	 */
	uploadImage: function(domObject, format, type, genMipmaps) {
		var gl = this.gl;

		format = format || gl.RGBA;
		type = type || gl.UNSIGNED_BYTE;
		
		this.width = domObject.width;
		this.height = domObject.height;

		this._checkPOT();

		this.bind();

		gl.texImage2D(this.target, 0, format, format,
					  type, domObject);

		if (genMipmaps)
			gl.generateMipmap(this.target);
	},

	/**
	 * If FORCE_POT is false, we verify this texture to see if it is valid, 
	 * as per non-power-of-two rules. If it is non-power-of-two, it must have 
	 * a wrap mode of CLAMP_TO_EDGE, and the minification filter must be LINEAR
	 * or NEAREST. If we don't satisfy these needs, an error is thrown.
	 * 
	 * @method  _checkPOT
	 * @private
	 * @return {[type]} [description]
	 */
	_checkPOT: function() {
		if (!Texture.FORCE_POT) {
			//If minFilter is anything but LINEAR or NEAREST
			//or if wrapS or wrapT are not CLAMP_TO_EDGE...
			var wrongFilter = (this.minFilter !== Texture.Filter.LINEAR && this.minFilter !== Texture.Filter.NEAREST);
			var wrongWrap = (this.wrapS !== Texture.Wrap.CLAMP_TO_EDGE || this.wrapT !== Texture.Wrap.CLAMP_TO_EDGE);

			if ( wrongFilter || wrongWrap ) {
				if (!isPowerOfTwo(this.width) || !isPowerOfTwo(this.height))
					throw new Error(wrongFilter 
							? "Non-power-of-two textures cannot use mipmapping as filter"
							: "Non-power-of-two textures must use CLAMP_TO_EDGE as wrap");
			}
		}
	},

	/**
	 * Binds the texture. If unit is specified,
	 * it will bind the texture at the given slot
	 * (TEXTURE0, TEXTURE1, etc). If unit is not specified,
	 * it will simply bind the texture at whichever slot
	 * is currently active.
	 *
	 * @method  bind
	 * @param  {Number} unit the texture unit index, starting at 0
	 */
	bind: function(unit) {
		var gl = this.gl;
		if (unit || unit === 0)
			gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(this.target, this.id);
	},

	toString: function() {
		return this.id + ":" + this.width + "x" + this.height + "";
	}
});

/** 
 * A set of Filter constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Filter.NEAREST
 *     Texture.Filter.NEAREST_MIPMAP_LINEAR
 *     Texture.Filter.NEAREST_MIPMAP_NEAREST
 *     Texture.Filter.LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_LINEAR
 *     Texture.Filter.LINEAR_MIPMAP_NEAREST
 * ```
 * @attribute Filter
 * @static
 * @type {Object}
 */
Texture.Filter = {
	NEAREST: 9728,
	NEAREST_MIPMAP_LINEAR: 9986,
	NEAREST_MIPMAP_NEAREST: 9984,
	LINEAR: 9729,
	LINEAR_MIPMAP_LINEAR: 9987,
	LINEAR_MIPMAP_NEAREST: 9985
};

/** 
 * A set of Wrap constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Wrap.CLAMP_TO_EDGE
 *     Texture.Wrap.MIRRORED_REPEAT
 *     Texture.Wrap.REPEAT
 * ```
 * @attribute Wrap
 * @static
 * @type {Object}
 */
Texture.Wrap = {
	CLAMP_TO_EDGE: 33071,
	MIRRORED_REPEAT: 33648,
	REPEAT: 10497
};

/** 
 * A set of Format constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.Format.RGB
 *     Texture.Format.RGBA
 *     Texture.Format.LUMINANCE_ALPHA
 * ```
 * @attribute Format
 * @static
 * @type {Object}
 */
Texture.Format = {
	DEPTH_COMPONENT: 6402,
	ALPHA: 6406,
	RGBA: 6408,
	RGB: 6407,
	LUMINANCE: 6409,
	LUMINANCE_ALPHA: 6410
};

/** 
 * A set of DataType constants that match their GL counterparts.
 * This is for convenience, to avoid the need for a GL rendering context.
 *
 * @example
 * ```
 *     Texture.DataType.UNSIGNED_BYTE 
 *     Texture.DataType.FLOAT 
 * ```
 * @attribute DataType
 * @static
 * @type {Object}
 */
Texture.DataType = {
	BYTE: 5120,
	SHORT: 5122,
	INT: 5124,
	FLOAT: 5126,
	UNSIGNED_BYTE: 5121,
	UNSIGNED_INT: 5125,
	UNSIGNED_SHORT: 5123,
	UNSIGNED_SHORT_4_4_4_4: 32819,
	UNSIGNED_SHORT_5_5_5_1: 32820,
	UNSIGNED_SHORT_5_6_5: 33635
}

/**
 * The default wrap mode when creating new textures. If a custom 
 * provider was specified, it may choose to override this default mode.
 * 
 * @attribute {GLenum} DEFAULT_WRAP
 * @static 
 * @default  Texture.Wrap.CLAMP_TO_EDGE
 */
Texture.DEFAULT_WRAP = Texture.Wrap.CLAMP_TO_EDGE;


/**
 * The default filter mode when creating new textures. If a custom
 * provider was specified, it may choose to override this default mode.
 *
 * @attribute {GLenum} DEFAULT_FILTER
 * @static
 * @default  Texture.Filter.LINEAR
 */
Texture.DEFAULT_FILTER = Texture.Filter.NEAREST;

/**
 * By default, we do some error checking when creating textures
 * to ensure that they will be "renderable" by WebGL. Non-power-of-two
 * textures must use CLAMP_TO_EDGE as their wrap mode, and NEAREST or LINEAR
 * as their wrap mode. Further, trying to generate mipmaps for a NPOT image
 * will lead to errors. 
 *
 * However, you can disable this error checking by setting `FORCE_POT` to true.
 * This may be useful if you are running on specific hardware that supports POT 
 * textures, or in some future case where NPOT textures is added as a WebGL extension.
 * 
 * @attribute {Boolean} FORCE_POT
 * @static
 * @default  false
 */
Texture.FORCE_POT = false;

//default pixel store operations. Used in create()
Texture.UNPACK_FLIP_Y = false;
Texture.UNPACK_ALIGNMENT = 1;
Texture.UNPACK_PREMULTIPLY_ALPHA = true; 
Texture.UNPACK_COLORSPACE_CONVERSION = undefined;

//for the Image constructor we need to handle things a bit differently..
Texture.USE_DUMMY_1x1_DATA = true;

/**
 * Utility to get the number of components for the given GLenum, e.g. gl.RGBA returns 4.
 * Returns null if the specified format is not of type DEPTH_COMPONENT, ALPHA, LUMINANCE,
 * LUMINANCE_ALPHA, RGB, or RGBA.
 * 
 * @method getNumComponents
 * @static
 * @param  {GLenum} format a texture format, i.e. Texture.Format.RGBA
 * @return {Number} the number of components for this format
 */
Texture.getNumComponents = function(format) {
	switch (format) {
		case Texture.Format.DEPTH_COMPONENT:
		case Texture.Format.ALPHA:
		case Texture.Format.LUMINANCE:
			return 1;
		case Texture.Format.LUMINANCE_ALPHA:
			return 2;
		case Texture.Format.RGB:
			return 3;
		case Texture.Format.RGBA:
			return 4;
	}
	return null;
};

module.exports = Texture;
},{"klasse":14,"number-util":12,"signals":13}],6:[function(require,module,exports){
var Class = require('klasse');

//This is a GL-specific texture region, employing tangent space normalized coordinates U and V.
//A canvas-specific region would really just be a lightweight object with { x, y, width, height }
//in pixels.
var TextureRegion = new Class({

	initialize: function TextureRegion(texture, x, y, width, height) {
		this.texture = texture;
		this.setRegion(x, y, width, height);
	},

	setUVs: function(u, v, u2, v2) {
		this.regionWidth = Math.round(Math.abs(u2 - u) * this.texture.width);
        this.regionHeight = Math.round(Math.abs(v2 - v) * this.texture.height);

        // From LibGDX TextureRegion.java -- 
		// For a 1x1 region, adjust UVs toward pixel center to avoid filtering artifacts on AMD GPUs when drawing very stretched.
		if (this.regionWidth == 1 && this.regionHeight == 1) {
			var adjustX = 0.25 / this.texture.width;
			u += adjustX;
			u2 -= adjustX;
			var adjustY = 0.25 / this.texture.height;
			v += adjustY;
			v2 -= adjustY;
		}

		this.u = u;
		this.v = v;
		this.u2 = u2;
		this.v2 = v2;
	},

	setRegion: function(x, y, width, height) {
		x = x || 0;
		y = y || 0;
		width = (width===0 || width) ? width : this.texture.width;
		height = (height===0 || height) ? height : this.texture.height;

		var invTexWidth = 1 / this.texture.width;
		var invTexHeight = 1 / this.texture.height;
		this.setUVs(x * invTexWidth, y * invTexHeight, (x + width) * invTexWidth, (y + height) * invTexHeight);
		this.regionWidth = Math.abs(width);
		this.regionHeight = Math.abs(height);
	},

	/** Sets the texture to that of the specified region and sets the coordinates relative to the specified region. */
	setFromRegion: function(region, x, y, width, height) {
		this.texture = region.texture;
		this.set(region.getRegionX() + x, region.getRegionY() + y, width, height);
	},


	//TODO: add setters for regionX/Y and regionWidth/Height

	regionX: {
		get: function() {
			return Math.round(this.u * this.texture.width);
		} 
	},

	regionY: {
		get: function() {
			return Math.round(this.v * this.texture.height);
		}
	},

	flip: function(x, y) {
		var temp;
		if (x) {
			temp = this.u;
			this.u = this.u2;
			this.u2 = temp;
		}
		if (y) {
			temp = this.v;
			this.v = this.v2;
			this.v2 = temp;
		}
	}
});

module.exports = TextureRegion;
},{"klasse":14}],7:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');
var Signal = require('signals');

/**
 * A thin wrapper around WebGLRenderingContext which handles
 * context loss and restore with various rendering objects (textures,
 * shaders and buffers). This also handles general viewport management.
 *
 * If the view is not specified, a canvas will be created.
 *
 * If the `view` parameter is an instanceof WebGLRenderingContext,
 * we will use its canvas and context without fetching another through `getContext`.
 * Passing a canvas that has already had `getContext('webgl')` called will not cause
 * errors, but in certain debuggers (e.g. Chrome WebGL Inspector) only the latest
 * context will be traced.
 * 
 * @class  WebGLContext
 * @constructor
 * @param {Number} width the width of the GL canvas
 * @param {Number} height the height of the GL canvas
 * @param {HTMLCanvasElement} view the optional DOM canvas element
 * @param {Object} contextAttribuets an object containing context attribs which
 *                                   will be used during GL initialization
 */
var WebGLContext = new Class({
	
	initialize: function WebGLContext(width, height, view, contextAttributes) {
		/**
		 * The list of rendering objects (shaders, VBOs, textures, etc) which are 
		 * currently being managed. Any object with a "create" method can be added
		 * to this list. Upon destroying the rendering object, it should be removed.
		 * See addManagedObject and removeManagedObject.
		 * 
		 * @property {Array} managedObjects
		 */
		this.managedObjects = [];

		/**
		 * The actual GL context. You can use this for
		 * raw GL calls or to access GLenum constants. This
		 * will be updated on context restore. While the WebGLContext
		 * is not `valid`, you should not try to access GL state.
		 * 
		 * @property gl
		 * @type {WebGLRenderingContext}
		 */
		this.gl = null;

		if (view && typeof window.WebGLRenderingContext !== "undefined"
				 && view instanceof window.WebGLRenderingContext) {
			view = view.canvas;
			this.gl = view;
			this.valid = true;
			contextAttributes = undefined; //just ignore new attribs...
		}

		/**
		 * The canvas DOM element for this context.
		 * @property {Number} view
		 */
		this.view = view || document.createElement("canvas");

		//default size as per spec:
		//http://www.w3.org/TR/2012/WD-html5-author-20120329/the-canvas-element.html#the-canvas-element
		
		/**
		 * The width of this canvas.
		 *
		 * @property width
		 * @type {Number}
		 */
		this.width = this.view.width = width || 300;

		/**
		 * The height of this canvas.
		 * @property height
		 * @type {Number}
		 */
		this.height = this.view.height = height || 150;


		/**
		 * The context attributes for initializing the GL state. This might include
		 * anti-aliasing, alpha settings, verison, and so forth.
		 * 
		 * @property {Object} contextAttributes 
		 */
		this.contextAttributes = contextAttributes;
		
		/**
		 * Whether this context is 'valid', i.e. renderable. A context that has been lost
		 * (and not yet restored) or destroyed is invalid.
		 * 
		 * @property {Boolean} valid
		 */
		this.valid = false;

		/**
		 * A signal dispatched when GL context is lost. 
		 * 
		 * The first argument passed to the listener is the WebGLContext
		 * managing the context loss.
		 * 
		 * @event {Signal} lost
		 */
		this.lost = new Signal();

		/**
		 * A signal dispatched when GL context is restored, after all the managed
		 * objects have been recreated.
		 *
		 * The first argument passed to the listener is the WebGLContext
		 * which managed the restoration.
		 *
		 * This does not gaurentee that all objects will be renderable.
		 * For example, a Texture with an ImageProvider may still be loading
		 * asynchronously.	 
		 * 
		 * @event {Signal} restored
		 */
		this.restored = new Signal();	
		
		//setup context lost and restore listeners
		this.view.addEventListener("webglcontextlost", function (ev) {
			ev.preventDefault();
			this._contextLost(ev);
		}.bind(this));
		this.view.addEventListener("webglcontextrestored", function (ev) {
			ev.preventDefault();
			this._contextRestored(ev);
		}.bind(this));
			
		if (!this.valid) //would only be valid if WebGLRenderingContext was passed 
			this._initContext();

		this.resize(this.width, this.height);
	},
	
	_initContext: function() {
		var err = "";
		this.valid = false;

		try {
			this.gl = (this.view.getContext('webgl', this.contextAttributes) 
						|| this.view.getContext('experimental-webgl', this.contextAttributes));
		} catch (e) {
			this.gl = null;
		}

		if (this.gl) {
			this.valid = true;
		} else {
			throw "WebGL Context Not Supported -- try enabling it or using a different browser";
		}	
	},

	/**
	 * Updates the width and height of this WebGL context, resizes
	 * the canvas view, and calls gl.viewport() with the new size.
	 * 
	 * @param  {Number} width  the new width
	 * @param  {Number} height the new height
	 */
	resize: function(width, height) {
		this.width = width;
		this.height = height;

		this.view.width = width;
		this.view.height = height;

		var gl = this.gl;
		gl.viewport(0, 0, this.width, this.height);
	},

	/**
	 * (internal use)
	 * A managed object is anything with a "create" function, that will
	 * restore GL state after context loss. 
	 * 
	 * @param {[type]} tex [description]
	 */
	addManagedObject: function(obj) {
		this.managedObjects.push(obj);
	},

	/**
	 * (internal use)
	 * Removes a managed object from the cache. This is useful to destroy
	 * a texture or shader, and have it no longer re-load on context restore.
	 *
	 * Returns the object that was removed, or null if it was not found in the cache.
	 * 
	 * @param  {Object} obj the object to be managed
	 * @return {Object}     the removed object, or null
	 */
	removeManagedObject: function(obj) {
		var idx = this.managedObjects.indexOf(obj);
		if (idx > -1) {
			this.managedObjects.splice(idx, 1);
			return obj;
		} 
		return null;
	},

	/**
	 * Calls destroy() on each managed object, then removes references to these objects
	 * and the GL rendering context. This also removes references to the view and sets
	 * the context's width and height to zero.
	 *
	 * Attempting to use this WebGLContext or the GL rendering context after destroying it
	 * will lead to undefined behaviour.
	 */
	destroy: function() {
		for (var i=0; i<this.managedObjects.length; i++) {
			var obj = this.managedObjects[i];
			if (obj && typeof obj.destroy === "function")
				obj.destroy();
		}
		this.managedObjects.length = 0;
		this.valid = false;
		this.gl = null;
		this.view = null;
		this.width = this.height = 0;
	},

	_contextLost: function(ev) {
		//all textures/shaders/buffers/FBOs have been deleted... 
		//we need to re-create them on restore
		this.valid = false;

		this.lost.dispatch(this);
	},

	_contextRestored: function(ev) {
		//first, initialize the GL context again
		this._initContext();

		//now we recreate our shaders and textures
		for (var i=0; i<this.managedObjects.length; i++) {
			this.managedObjects[i].create();
		}

		//update GL viewport
		this.resize(this.width, this.height);

		this.restored.dispatch(this);
	}
});

module.exports = WebGLContext;
},{"klasse":14,"signals":13}],8:[function(require,module,exports){
var Class = require('klasse');
var Texture = require('../Texture');


var FrameBuffer = new Class({

	/**
	 * Creates a new Frame Buffer Object with the given width and height.
	 *
	 * If width and height are non-numbers, this method expects the
	 * first parameter to be a Texture object which should be acted upon. 
	 * In this case, the FrameBuffer does not "own" the texture, and so it
	 * won't dispose of it upon destruction. This is an advanced version of the
	 * constructor that assumes the user is giving us a valid Texture that can be bound (i.e.
	 * no async Image textures).
	 *
	 * @class  FrameBuffer
	 * @constructor
	 * @param  {[type]} width  [description]
	 * @param  {[type]} height [description]
	 * @param  {[type]} filter [description]
	 * @return {[type]}        [description]
	 */
	initialize: function FrameBuffer(context, width, height, format) { //TODO: depth component
		if (typeof context !== "object")
			throw "GL context not specified to FrameBuffer";
	

		/**
		 * The underlying ID of the GL frame buffer object.
		 *
		 * @property {WebGLFramebuffer} id
		 */		
		this.id = null;

		/**
		 * The WebGLContext backed by this frame buffer.
		 *
		 * @property {WebGLContext} context
		 */
		this.context = context;

		/**
		 * The Texture backed by this frame buffer.
		 *
		 * @property {Texture} Texture
		 */
		//this Texture is now managed.
		this.texture = new Texture(context, width, height, format);

		//This is maanged by WebGLContext
		this.context.addManagedObject(this);
		this.create();
	},

	/**
	 * A read-only property which returns the width of the backing texture. 
	 * 
	 * @readOnly
	 * @property width
	 * @type {Number}
	 */
	width: {
		get: function() {
			return this.texture.width
		}
	},

	/**
	 * A read-only property which returns the height of the backing texture. 
	 * 
	 * @readOnly
	 * @property height
	 * @type {Number}
	 */
	height: {
		get: function() {
			return this.texture.height;
		}
	},


	/**
	 * Called during initialization to setup the frame buffer; also called on
	 * context restore. Users will not need to call this directly.
	 * 
	 * @method create
	 */
	create: function() {
		this.gl = this.context.gl; 
		var gl = this.gl;

		var tex = this.texture;

		//we assume the texture has already had create() called on it
		//since it was added as a managed object prior to this FrameBuffer
		tex.bind();
 
		this.id = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.target, tex.id, 0);

		var result = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (result != gl.FRAMEBUFFER_COMPLETE) {
			this.destroy(); //destroy our resources before leaving this function..

			var err = "Framebuffer not complete";
			switch (result) {
				case gl.FRAMEBUFFER_UNSUPPORTED:
					throw new Error(err + ": unsupported");
				case gl.INCOMPLETE_DIMENSIONS:
					throw new Error(err + ": incomplete dimensions");
				case gl.INCOMPLETE_ATTACHMENT:
					throw new Error(err + ": incomplete attachment");
				case gl.INCOMPLETE_MISSING_ATTACHMENT:
					throw new Error(err + ": missing attachment");
				default:
					throw new Error(err);
			}
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	},


	/**
	 * Destroys this frame buffer. Using this object after destroying it will have
	 * undefined results. 
	 * @method destroy
	 */
	destroy: function() {
		var gl = this.gl;

		if (this.texture)
			this.texture.destroy();
		if (this.id && this.gl)
			this.gl.deleteFramebuffer(this.id);
		if (this.context)
			this.context.removeManagedObject(this);

		this.id = null;
		this.gl = null;
		this.texture = null;
		this.context = null;
	},

	/**
	 * Binds this framebuffer and sets the viewport to the expected size.
	 * @method begin
	 */
	begin: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.texture.width, this.texture.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
	},

	/**
	 * Binds the default frame buffer (the screen) and sets the viewport back
	 * to the size of the WebGLContext.
	 * 
	 * @method end
	 */
	end: function() {
		var gl = this.gl;
		gl.viewport(0, 0, this.context.width, this.context.height);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
});

module.exports = FrameBuffer;
},{"../Texture":5,"klasse":14}],9:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');

//TODO: decouple into VBO + IBO utilities 
/**
 * A mesh class that wraps VBO and IBO.
 *
 * @class  Mesh
 */
var Mesh = new Class({


	/**
	 * A write-only property which sets both vertices and indices 
	 * flag to dirty or not. 
	 *
	 * @property dirty
	 * @type {Boolean}
	 * @writeOnly
	 */
	dirty: {
		set: function(val) {
			this.verticesDirty = val;
			this.indicesDirty = val;
		}
	},

	/**
	 * Creates a new Mesh with the provided parameters.
	 *
	 * If numIndices is 0 or falsy, no index buffer will be used
	 * and indices will be an empty ArrayBuffer and a null indexBuffer.
	 * 
	 * If isStatic is true, then vertexUsage and indexUsage will
	 * be set to gl.STATIC_DRAW. Otherwise they will use gl.DYNAMIC_DRAW.
	 * You may want to adjust these after initialization for further control.
	 * 
	 * @param  {WebGLContext}  context the context for management
	 * @param  {Boolean} isStatic      a hint as to whether this geometry is static
	 * @param  {[type]}  numVerts      [description]
	 * @param  {[type]}  numIndices    [description]
	 * @param  {[type]}  vertexAttribs [description]
	 * @return {[type]}                [description]
	 */
	initialize: function Mesh(context, isStatic, numVerts, numIndices, vertexAttribs) {
		if (typeof context !== "object")
			throw "GL context not specified to Mesh";
		if (!numVerts)
			throw "numVerts not specified, must be > 0";

		this.context = context;
		this.gl = context.gl;
		
		this.numVerts = null;
		this.numIndices = null;
		
		this.vertices = null;
		this.indices = null;
		this.vertexBuffer = null;
		this.indexBuffer = null;

		this.verticesDirty = true;
		this.indicesDirty = true;
		this.indexUsage = null;
		this.vertexUsage = null;

		/** 
		 * @property
		 * @private
		 */
		this._vertexAttribs = null;

		/** 
		 * The stride for one vertex _in bytes_. 
		 * 
		 * @property {Number} vertexStride
		 */
		this.vertexStride = null;

		this.numVerts = numVerts;
		this.numIndices = numIndices || 0;
		this.vertexUsage = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this.indexUsage  = isStatic ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW;
		this._vertexAttribs = vertexAttribs || [];
		
		this.indicesDirty = true;
		this.verticesDirty = true;

		//determine the vertex stride based on given attributes
		var totalNumComponents = 0;
		for (var i=0; i<this._vertexAttribs.length; i++)
			totalNumComponents += this._vertexAttribs[i].offsetCount;
		this.vertexStride = totalNumComponents * 4; // in bytes

		this.vertices = new Float32Array(this.numVerts);
		this.indices = new Uint16Array(this.numIndices);

		//add this VBO to the managed cache
		this.context.addManagedObject(this);

		this.create();
	},

	//recreates the buffers on context loss
	create: function() {
		this.gl = this.context.gl;
		var gl = this.gl;
		this.vertexBuffer = gl.createBuffer();

		//ignore index buffer if we haven't specified any
		this.indexBuffer = this.numIndices > 0
					? gl.createBuffer()
					: null;

		this.dirty = true;
	},

	destroy: function() {
		this.vertices = null;
		this.indices = null;
		if (this.vertexBuffer && this.gl)
			this.gl.deleteBuffer(this.vertexBuffer);
		if (this.indexBuffer && this.gl)
			this.gl.deleteBuffer(this.indexBuffer);
		this.vertexBuffer = null;
		this.indexBuffer = null;
		if (this.context)
			this.context.removeManagedObject(this);
		this.gl = null;
		this.context = null;
	},

	_updateBuffers: function(ignoreBind, subDataLength) {
		var gl = this.gl;

		//bind our index data, if we have any
		if (this.numIndices > 0) {
			if (!ignoreBind)
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

			//update the index data
			if (this.indicesDirty) {
				gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, this.indexUsage);
				this.indicesDirty = false;
			}
		}

		//bind our vertex data
		if (!ignoreBind)
			gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

		//update our vertex data
		if (this.verticesDirty) {
			if (subDataLength) {
				// TODO: When decoupling VBO/IBO be sure to give better subData support..
				var view = this.vertices.subarray(0, subDataLength);
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, view);
			} else {
				gl.bufferData(gl.ARRAY_BUFFER, this.vertices, this.vertexUsage);	
			}

			
			this.verticesDirty = false;
		}
	},

	draw: function(primitiveType, count, offset, subDataLength) {
		if (count === 0)
			return;

		var gl = this.gl;
		
		offset = offset || 0;

		//binds and updates our buffers. pass ignoreBind as true
		//to avoid binding unnecessarily
		this._updateBuffers(true, subDataLength);

		if (this.numIndices > 0) { 
			gl.drawElements(primitiveType, count, 
						gl.UNSIGNED_SHORT, offset * 2); //* Uint16Array.BYTES_PER_ELEMENT
		} else
			gl.drawArrays(primitiveType, offset, count);
	},

	//binds this mesh's vertex attributes for the given shader
	bind: function(shader) {
		var gl = this.gl;

		var offset = 0;
		var stride = this.vertexStride;

		//bind and update our vertex data before binding attributes
		this._updateBuffers();

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

			//location of the attribute
			var loc = a.location === null 
					? shader.getAttributeLocation(a.name)
					: a.location;

			//TODO: We may want to skip unfound attribs
			// if (loc!==0 && !loc)
			// 	console.warn("WARN:", a.name, "is not enabled");

			//first, enable the vertex array
			gl.enableVertexAttribArray(loc);

			//then specify our vertex format
			gl.vertexAttribPointer(loc, a.numComponents, a.type || gl.FLOAT, 
								   a.normalize, stride, offset);

			//and increase the offset...
			offset += a.offsetCount * 4; //in bytes
		}
	},

	unbind: function(shader) {
		var gl = this.gl;

		//for each attribtue
		for (var i=0; i<this._vertexAttribs.length; i++) {
			var a = this._vertexAttribs[i];

			//location of the attribute
			var loc = a.location === null 
					? shader.getAttributeLocation(a.name)
					: a.location;

			//first, enable the vertex array
			gl.disableVertexAttribArray(loc);
		}
	}
});

Mesh.Attrib = new Class({

	name: null,
	numComponents: null,
	location: null,
	type: null,

	/**
	 * Location is optional and for advanced users that
	 * want vertex arrays to match across shaders. Any non-numerical
	 * value will be converted to null, and ignored. If a numerical
	 * value is given, it will override the position of this attribute
	 * when given to a mesh.
	 * 
	 * @param  {[type]} name          [description]
	 * @param  {[type]} numComponents [description]
	 * @param  {[type]} location      [description]
	 * @return {[type]}               [description]
	 */
	initialize: function(name, numComponents, location, type, normalize, offsetCount) {
		this.name = name;
		this.numComponents = numComponents;
		this.location = typeof location === "number" ? location : null;
		this.type = type;
		this.normalize = Boolean(normalize);
		this.offsetCount = typeof offsetCount === "number" ? offsetCount : this.numComponents;
	}
})


module.exports = Mesh;
},{"klasse":14}],10:[function(require,module,exports){
/**
 * @module kami
 */

var Class = require('klasse');


var ShaderProgram = new Class({
	
	/**
	 * Creates a new ShaderProgram from the given source, and an optional map of attribute
	 * locations as <name, index> pairs.
	 *
	 * _Note:_ Chrome version 31 was giving me issues with attribute locations -- you may
	 * want to omit this to let the browser pick the locations for you.	
	 *
	 * @class  ShaderProgram
	 * @constructor
	 * @param  {WebGLContext} context      the context to manage this object
	 * @param  {String} vertSource         the vertex shader source
	 * @param  {String} fragSource         the fragment shader source
	 * @param  {Object} attributeLocations the attribute locations
	 */
	initialize: function ShaderProgram(context, vertSource, fragSource, attributeLocations) {
		if (!vertSource || !fragSource)
			throw "vertex and fragment shaders must be defined";
		if (typeof context !== "object")
			throw "GL context not specified to ShaderProgram";
		this.context = context;

		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.log = "";

		this.uniformCache = null;
		this.attributeCache = null;

		this.attributeLocations = attributeLocations;

		//We trim (ECMAScript5) so that the GLSL line numbers are
		//accurate on shader log
		this.vertSource = vertSource.trim();
		this.fragSource = fragSource.trim();

		//Adds this shader to the context, to be managed
		this.context.addManagedObject(this);

		this.create();
	},

	/** 
	 * This is called during the ShaderProgram constructor,
	 * and may need to be called again after context loss and restore.
	 * 
	 * @method  create
	 */
	create: function() {
		this.gl = this.context.gl;
		this._compileShaders();
	},

	//Compiles the shaders, throwing an error if the program was invalid.
	_compileShaders: function() {
		var gl = this.gl; 
		
		this.log = "";

		this.vertShader = this._loadShader(gl.VERTEX_SHADER, this.vertSource);
		this.fragShader = this._loadShader(gl.FRAGMENT_SHADER, this.fragSource);

		if (!this.vertShader || !this.fragShader)
			throw "Error returned when calling createShader";

		this.program = gl.createProgram();

		gl.attachShader(this.program, this.vertShader);
		gl.attachShader(this.program, this.fragShader);
	
		//TODO: This seems not to be working on my OSX -- maybe a driver bug?
		if (this.attributeLocations) {
			for (var key in this.attributeLocations) {
				if (this.attributeLocations.hasOwnProperty(key)) {
					gl.bindAttribLocation(this.program, Math.floor(this.attributeLocations[key]), key);
				}
			}
		}

		gl.linkProgram(this.program); 

		this.log += gl.getProgramInfoLog(this.program) || "";

		if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
			throw "Error linking the shader program:\n"
				+ this.log;
		}

		this._fetchUniforms();
		this._fetchAttributes();
	},

	_fetchUniforms: function() {
		var gl = this.gl;

		this.uniformCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
		if (!len) //null or zero
			return;

		for (var i=0; i<len; i++) {
			var info = gl.getActiveUniform(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;
			var location = gl.getUniformLocation(this.program, name);
			
			this.uniformCache[name] = {
				size: info.size,
				type: info.type,
				location: location
			};
		}
	},

	_fetchAttributes: function() { 
		var gl = this.gl; 

		this.attributeCache = {};

		var len = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
		if (!len) //null or zero
			return;	

		for (var i=0; i<len; i++) {
			var info = gl.getActiveAttrib(this.program, i);
			if (info === null) 
				continue;
			var name = info.name;

			//the attrib location is a simple index
			var location = gl.getAttribLocation(this.program, name);
			
			this.attributeCache[name] = {
				size: info.size,
				type: info.type,
				location: location
			};
		}
	},

	_loadShader: function(type, source) {
		var gl = this.gl;

		var shader = gl.createShader(type);
		if (!shader) //should not occur...
			return -1;

		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		
		var logResult = gl.getShaderInfoLog(shader) || "";
		if (logResult) {
			//we do this so the user knows which shader has the error
			var typeStr = (type === gl.VERTEX_SHADER) ? "vertex" : "fragment";
			logResult = "Error compiling "+ typeStr+ " shader:\n"+logResult;
		}

		this.log += logResult;

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
			throw this.log;
		}
		return shader;
	},

	/**
	 * Called to bind this shader. Note that there is no "unbind" since
	 * technically such a thing is not possible in the programmable pipeline.
	 *
	 * You must bind a shader before settings its uniforms.
	 * 
	 * @method bind
	 */
	bind: function() {
		this.gl.useProgram(this.program);
	},


	/**
	 * Destroys this shader and its resources. You should not try to use this
	 * after destroying it.
	 * @method  destroy
	 */
	destroy: function() {
		if (this.context)
			this.context.removeManagedObject(this);

		if (this.gl && this.program) {
			var gl = this.gl;
			gl.detachShader(this.program, this.vertShader);
			gl.detachShader(this.program, this.fragShader);

			gl.deleteShader(this.vertShader);
			gl.deleteShader(this.fragShader);
			gl.deleteProgram(this.program);
		}
		this.attributeCache = null;
		this.uniformCache = null;
		this.vertShader = null;
		this.fragShader = null;
		this.program = null;
		this.gl = null;
		this.context = null;
	},


	/**
	 * Returns the cached uniform info (size, type, location).
	 * If the uniform is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the uniform is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program) then it may
	 * be optimized out.
	 *
	 * @method  getUniformInfo
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {Object} an object containing location, size, and type
	 */
	getUniformInfo: function(name) {
		return this.uniformCache[name] || null; 
	},

	/**
	 * Returns the cached attribute info (size, type, location).
	 * If the attribute is not found in the cache, it is assumed
	 * to not exist, and this method returns null.
	 *
	 * This may return null even if the attribute is defined in GLSL:
	 * if it is _inactive_ (i.e. not used in the program or disabled) 
	 * then it may be optimized out.
	 *
	 * @method  getAttributeInfo
	 * @param  {String} name the attribute name as defined in GLSL
	 * @return {object} an object containing location, size and type
	 */
	getAttributeInfo: function(name) {
		return this.attributeCache[name] || null; 
	},


	/**
	 * Returns the cached uniform location object.
	 * If the uniform is not found, this method returns null.
	 *
	 * @method  getAttributeLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {GLint} the location object
	 */
	getAttributeLocation: function(name) { //TODO: make faster, don't cache
		var info = this.getAttributeInfo(name);
		return info ? info.location : null;
	},

	/**
	 * Returns the cached uniform location object, assuming it exists
	 * and is active. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  getUniformLocation
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {WebGLUniformLocation} the location object
	 */
	getUniformLocation: function(name) {
		var info = this.getUniformInfo(name);
		return info ? info.location : null;
	},

	/**
	 * Returns true if the uniform is active and found in this
	 * compiled program. Note that uniforms may be inactive if 
	 * the GLSL compiler deemed them unused.
	 *
	 * @method  hasUniform
	 * @param  {String}  name the uniform name
	 * @return {Boolean} true if the uniform is found and active
	 */
	hasUniform: function(name) {
		return this.getUniformInfo(name) !== null;
	},

	/**
	 * Returns true if the attribute is active and found in this
	 * compiled program.
	 *
	 * @method  hasAttribute
	 * @param  {String}  name the attribute name
	 * @return {Boolean} true if the attribute is found and active
	 */
	hasAttribute: function(name) {
		return this.getAttributeInfo(name) !== null;
	},

	/**
	 * Returns the uniform value by name.
	 *
	 * @method  getUniform
	 * @param  {String} name the uniform name as defined in GLSL
	 * @return {any} The value of the WebGL uniform
	 */
	getUniform: function(name) {
		return this.gl.getUniform(this.program, this.getUniformLocation(name));
	},

	/**
	 * Returns the uniform value at the specified WebGLUniformLocation.
	 *
	 * @method  getUniformAt
	 * @param  {WebGLUniformLocation} location the location object
	 * @return {any} The value of the WebGL uniform
	 */
	getUniformAt: function(location) {
		return this.gl.getUniform(this.program, location);
	},

	/**
	 * A convenience method to set uniformi from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformi("var", 0, 1)` maps to `gl.uniform2i`.
	 * 
	 * @method  setUniformi
	 * @param {String} name        		the name of the uniform
	 * @param {GLint} x  the x component for ints
	 * @param {GLint} y  the y component for ivec2
	 * @param {GLint} z  the z component for ivec3
	 * @param {GLint} w  the w component for ivec4
	 */
	setUniformi: function(name, x, y, z, w) {
		'use strict';
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1i(loc, x); return true;
			case 3: gl.uniform2i(loc, x, y); return true;
			case 4: gl.uniform3i(loc, x, y, z); return true;
			case 5: gl.uniform4i(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformi"; 
		}
	},

	/**
	 * A convenience method to set uniformf from the given arguments.
	 * We determine which GL call to make based on the number of arguments
	 * passed. For example, `setUniformf("var", 0, 1)` maps to `gl.uniform2f`.
	 * 
	 * @method  setUniformf
	 * @param {String} name        		the name of the uniform
	 * @param {GLfloat} x  the x component for floats
	 * @param {GLfloat} y  the y component for vec2
	 * @param {GLfloat} z  the z component for vec3
	 * @param {GLfloat} w  the w component for vec4
	 */
	setUniformf: function(name, x, y, z, w) {
		'use strict';
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (arguments.length) {
			case 2: gl.uniform1f(loc, x); return true;
			case 3: gl.uniform2f(loc, x, y); return true;
			case 4: gl.uniform3f(loc, x, y, z); return true;
			case 5: gl.uniform4f(loc, x, y, z, w); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	//I guess we won't support sequence<GLfloat> .. whatever that is ??
	

	///// 
	
	/**
	 * A convenience method to set uniformNfv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a Float32Array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformfv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for vec2
	 */
	setUniformfv: function(name, arrayBuffer, count) {
		'use strict';
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (count) {
			case 1: gl.uniform1fv(loc, arrayBuffer); return true;
			case 2: gl.uniform2fv(loc, arrayBuffer); return true;
			case 3: gl.uniform3fv(loc, arrayBuffer); return true;
			case 4: gl.uniform4fv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * A convenience method to set uniformNiv from the given ArrayBuffer.
	 * We determine which GL call to make based on the length of the array 
	 * buffer (for 1-4 component vectors stored in a int array). To use
	 * this method to upload data to uniform arrays, you need to specify the
	 * 'count' parameter; i.e. the data type you are using for that array. If
	 * specified, this will dictate whether to call uniform1fv, uniform2fv, etc.
	 *
	 * @method  setUniformiv
	 * @param {String} name        		the name of the uniform
	 * @param {ArrayBuffer} arrayBuffer the array buffer
	 * @param {Number} count            optional, the explicit data type count, e.g. 2 for ivec2
	 */
	setUniformiv: function(name, arrayBuffer, count) {
		'use strict';
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		switch (count) {
			case 1: gl.uniform1iv(loc, arrayBuffer); return true;
			case 2: gl.uniform2iv(loc, arrayBuffer); return true;
			case 3: gl.uniform3iv(loc, arrayBuffer); return true;
			case 4: gl.uniform4iv(loc, arrayBuffer); return true;
			default:
				throw "invalid arguments to setUniformf"; 
		}
	},

	/**
	 * This is a convenience function to pass a Matrix3 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix3, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix3|Float32Array} mat a Matrix3 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix3: function(name, mat, transpose) {
		'use strict';
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		gl.uniformMatrix3fv(loc, transpose, arr)
	},

	/**
	 * This is a convenience function to pass a Matrix4 (from vecmath,
	 * kami's preferred math library) or a Float32Array (e.g. gl-matrix)
	 * to a shader. If mat is an object with "val", it is considered to be
	 * a Matrix4, otherwise assumed to be a typed array being passed directly
	 * to the shader.
	 * 
	 * @param {String} name the uniform name
	 * @param {Matrix4|Float32Array} mat a Matrix4 or Float32Array
	 * @param {Boolean} transpose whether to transpose the matrix, default false
	 */
	setUniformMatrix4: function(name, mat, transpose) {
		'use strict';
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (loc === null)
			return false;
		gl.uniformMatrix4fv(loc, transpose, arr)
	} 
 
});

//Some default attribute names that parts of kami will use
//when creating a standard shader.
ShaderProgram.POSITION_ATTRIBUTE = "Position";
ShaderProgram.NORMAL_ATTRIBUTE = "Normal";
ShaderProgram.COLOR_ATTRIBUTE = "Color";
ShaderProgram.TEXCOORD_ATTRIBUTE = "TexCoord";

module.exports = ShaderProgram;
},{"klasse":14}],11:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Created on 2014-06-11.
*/
module.exports = {
    //core classes
    'BaseBatch':       require('./BaseBatch.js'),
    'SpriteBatch':     require('./SpriteBatch.js'),
    'Texture':         require('./Texture.js'),
    'TextureRegion':   require('./TextureRegion.js'),
    'WebGLContext':    require('./WebGLContext.js'),
    'FrameBuffer':     require('./glutils/FrameBuffer.js'),
    'Mesh':            require('./glutils/Mesh.js'),
    'ShaderProgram':   require('./glutils/ShaderProgram.js')
};
},{"./BaseBatch.js":3,"./SpriteBatch.js":4,"./Texture.js":5,"./TextureRegion.js":6,"./WebGLContext.js":7,"./glutils/FrameBuffer.js":8,"./glutils/Mesh.js":9,"./glutils/ShaderProgram.js":10}],12:[function(require,module,exports){
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);

/**
 * A singleton for number utilities. 
 * @class NumberUtil
 */
var NumberUtil = function() {

};


/**
 * Returns a float representation of the given int bits. ArrayBuffer
 * is used for the conversion.
 *
 * @method  intBitsToFloat
 * @static
 * @param  {Number} i the int to cast
 * @return {Number}   the float
 */
NumberUtil.intBitsToFloat = function(i) {
	int32[0] = i;
	return float32[0];
};

/**
 * Returns the int bits from the given float. ArrayBuffer is used
 * for the conversion.
 *
 * @method  floatToIntBits
 * @static
 * @param  {Number} f the float to cast
 * @return {Number}   the int bits
 */
NumberUtil.floatToIntBits = function(f) {
	float32[0] = f;
	return int32[0];
};

/**
 * Encodes ABGR int as a float, with slight precision loss.
 *
 * @method  intToFloatColor
 * @static
 * @param {Number} value an ABGR packed integer
 */
NumberUtil.intToFloatColor = function(value) {
	return NumberUtil.intBitsToFloat( value & 0xfeffffff );
};

/**
 * Returns a float encoded ABGR value from the given RGBA
 * bytes (0 - 255). Useful for saving bandwidth in vertex data.
 *
 * @method  colorToFloat
 * @static
 * @param {Number} r the Red byte (0 - 255)
 * @param {Number} g the Green byte (0 - 255)
 * @param {Number} b the Blue byte (0 - 255)
 * @param {Number} a the Alpha byte (0 - 255)
 * @return {Float32}  a Float32 of the RGBA color
 */
NumberUtil.colorToFloat = function(r, g, b, a) {
	var bits = (a << 24 | b << 16 | g << 8 | r);
	return NumberUtil.intToFloatColor(bits);
};

/**
 * Returns true if the number is a power-of-two.
 *
 * @method  isPowerOfTwo
 * @param  {Number}  n the number to test
 * @return {Boolean}   true if power-of-two
 */
NumberUtil.isPowerOfTwo = function(n) {
	return (n & (n - 1)) === 0;
};

/**
 * Returns the next highest power-of-two from the specified number. 
 * 
 * @param  {Number} n the number to test
 * @return {Number}   the next highest power of two
 */
NumberUtil.nextPowerOfTwo = function(n) {
	n--;
	n |= n >> 1;
	n |= n >> 2;
	n |= n >> 4;
	n |= n >> 8;
	n |= n >> 16;
	return n+1;
};

module.exports = NumberUtil;
},{}],13:[function(require,module,exports){
/*jslint onevar:true, undef:true, newcap:true, regexp:true, bitwise:true, maxerr:50, indent:4, white:false, nomen:false, plusplus:false */
/*global define:false, require:false, exports:false, module:false, signals:false */

/** @license
 * JS Signals <http://millermedeiros.github.com/js-signals/>
 * Released under the MIT license
 * Author: Miller Medeiros
 * Version: 1.0.0 - Build: 268 (2012/11/29 05:48 PM)
 */

(function(global){

    // SignalBinding -------------------------------------------------
    //================================================================

    /**
     * Object that represents a binding between a Signal and a listener function.
     * <br />- <strong>This is an internal constructor and shouldn't be called by regular users.</strong>
     * <br />- inspired by Joa Ebert AS3 SignalBinding and Robert Penner's Slot classes.
     * @author Miller Medeiros
     * @constructor
     * @internal
     * @name SignalBinding
     * @param {Signal} signal Reference to Signal object that listener is currently bound to.
     * @param {Function} listener Handler function bound to the signal.
     * @param {boolean} isOnce If binding should be executed just once.
     * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
     * @param {Number} [priority] The priority level of the event listener. (default = 0).
     */
    function SignalBinding(signal, listener, isOnce, listenerContext, priority) {

        /**
         * Handler function bound to the signal.
         * @type Function
         * @private
         */
        this._listener = listener;

        /**
         * If binding should be executed just once.
         * @type boolean
         * @private
         */
        this._isOnce = isOnce;

        /**
         * Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @memberOf SignalBinding.prototype
         * @name context
         * @type Object|undefined|null
         */
        this.context = listenerContext;

        /**
         * Reference to Signal object that listener is currently bound to.
         * @type Signal
         * @private
         */
        this._signal = signal;

        /**
         * Listener priority
         * @type Number
         * @private
         */
        this._priority = priority || 0;
    }

    SignalBinding.prototype = {

        /**
         * If binding is active and should be executed.
         * @type boolean
         */
        active : true,

        /**
         * Default parameters passed to listener during `Signal.dispatch` and `SignalBinding.execute`. (curried parameters)
         * @type Array|null
         */
        params : null,

        /**
         * Call listener passing arbitrary parameters.
         * <p>If binding was added using `Signal.addOnce()` it will be automatically removed from signal dispatch queue, this method is used internally for the signal dispatch.</p>
         * @param {Array} [paramsArr] Array of parameters that should be passed to the listener
         * @return {*} Value returned by the listener.
         */
        execute : function (paramsArr) {
            var handlerReturn, params;
            if (this.active && !!this._listener) {
                params = this.params? this.params.concat(paramsArr) : paramsArr;
                handlerReturn = this._listener.apply(this.context, params);
                if (this._isOnce) {
                    this.detach();
                }
            }
            return handlerReturn;
        },

        /**
         * Detach binding from signal.
         * - alias to: mySignal.remove(myBinding.getListener());
         * @return {Function|null} Handler function bound to the signal or `null` if binding was previously detached.
         */
        detach : function () {
            return this.isBound()? this._signal.remove(this._listener, this.context) : null;
        },

        /**
         * @return {Boolean} `true` if binding is still bound to the signal and have a listener.
         */
        isBound : function () {
            return (!!this._signal && !!this._listener);
        },

        /**
         * @return {boolean} If SignalBinding will only be executed once.
         */
        isOnce : function () {
            return this._isOnce;
        },

        /**
         * @return {Function} Handler function bound to the signal.
         */
        getListener : function () {
            return this._listener;
        },

        /**
         * @return {Signal} Signal that listener is currently bound to.
         */
        getSignal : function () {
            return this._signal;
        },

        /**
         * Delete instance properties
         * @private
         */
        _destroy : function () {
            delete this._signal;
            delete this._listener;
            delete this.context;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[SignalBinding isOnce:' + this._isOnce +', isBound:'+ this.isBound() +', active:' + this.active + ']';
        }

    };


/*global SignalBinding:false*/

    // Signal --------------------------------------------------------
    //================================================================

    function validateListener(listener, fnName) {
        if (typeof listener !== 'function') {
            throw new Error( 'listener is a required param of {fn}() and should be a Function.'.replace('{fn}', fnName) );
        }
    }

    /**
     * Custom event broadcaster
     * <br />- inspired by Robert Penner's AS3 Signals.
     * @name Signal
     * @author Miller Medeiros
     * @constructor
     */
    function Signal() {
        /**
         * @type Array.<SignalBinding>
         * @private
         */
        this._bindings = [];
        this._prevParams = null;

        // enforce dispatch to aways work on same context (#47)
        var self = this;
        this.dispatch = function(){
            Signal.prototype.dispatch.apply(self, arguments);
        };
    }

    Signal.prototype = {

        /**
         * Signals Version Number
         * @type String
         * @const
         */
        VERSION : '1.0.0',

        /**
         * If Signal should keep record of previously dispatched parameters and
         * automatically execute listener during `add()`/`addOnce()` if Signal was
         * already dispatched before.
         * @type boolean
         */
        memorize : false,

        /**
         * @type boolean
         * @private
         */
        _shouldPropagate : true,

        /**
         * If Signal is active and should broadcast events.
         * <p><strong>IMPORTANT:</strong> Setting this property during a dispatch will only affect the next dispatch, if you want to stop the propagation of a signal use `halt()` instead.</p>
         * @type boolean
         */
        active : true,

        /**
         * @param {Function} listener
         * @param {boolean} isOnce
         * @param {Object} [listenerContext]
         * @param {Number} [priority]
         * @return {SignalBinding}
         * @private
         */
        _registerListener : function (listener, isOnce, listenerContext, priority) {

            var prevIndex = this._indexOfListener(listener, listenerContext),
                binding;

            if (prevIndex !== -1) {
                binding = this._bindings[prevIndex];
                if (binding.isOnce() !== isOnce) {
                    throw new Error('You cannot add'+ (isOnce? '' : 'Once') +'() then add'+ (!isOnce? '' : 'Once') +'() the same listener without removing the relationship first.');
                }
            } else {
                binding = new SignalBinding(this, listener, isOnce, listenerContext, priority);
                this._addBinding(binding);
            }

            if(this.memorize && this._prevParams){
                binding.execute(this._prevParams);
            }

            return binding;
        },

        /**
         * @param {SignalBinding} binding
         * @private
         */
        _addBinding : function (binding) {
            //simplified insertion sort
            var n = this._bindings.length;
            do { --n; } while (this._bindings[n] && binding._priority <= this._bindings[n]._priority);
            this._bindings.splice(n + 1, 0, binding);
        },

        /**
         * @param {Function} listener
         * @return {number}
         * @private
         */
        _indexOfListener : function (listener, context) {
            var n = this._bindings.length,
                cur;
            while (n--) {
                cur = this._bindings[n];
                if (cur._listener === listener && cur.context === context) {
                    return n;
                }
            }
            return -1;
        },

        /**
         * Check if listener was attached to Signal.
         * @param {Function} listener
         * @param {Object} [context]
         * @return {boolean} if Signal has the specified listener.
         */
        has : function (listener, context) {
            return this._indexOfListener(listener, context) !== -1;
        },

        /**
         * Add a listener to the signal.
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        add : function (listener, listenerContext, priority) {
            validateListener(listener, 'add');
            return this._registerListener(listener, false, listenerContext, priority);
        },

        /**
         * Add listener to the signal that should be removed after first execution (will be executed only once).
         * @param {Function} listener Signal handler function.
         * @param {Object} [listenerContext] Context on which listener will be executed (object that should represent the `this` variable inside listener function).
         * @param {Number} [priority] The priority level of the event listener. Listeners with higher priority will be executed before listeners with lower priority. Listeners with same priority level will be executed at the same order as they were added. (default = 0)
         * @return {SignalBinding} An Object representing the binding between the Signal and listener.
         */
        addOnce : function (listener, listenerContext, priority) {
            validateListener(listener, 'addOnce');
            return this._registerListener(listener, true, listenerContext, priority);
        },

        /**
         * Remove a single listener from the dispatch queue.
         * @param {Function} listener Handler function that should be removed.
         * @param {Object} [context] Execution context (since you can add the same handler multiple times if executing in a different context).
         * @return {Function} Listener handler function.
         */
        remove : function (listener, context) {
            validateListener(listener, 'remove');

            var i = this._indexOfListener(listener, context);
            if (i !== -1) {
                this._bindings[i]._destroy(); //no reason to a SignalBinding exist if it isn't attached to a signal
                this._bindings.splice(i, 1);
            }
            return listener;
        },

        /**
         * Remove all listeners from the Signal.
         */
        removeAll : function () {
            var n = this._bindings.length;
            while (n--) {
                this._bindings[n]._destroy();
            }
            this._bindings.length = 0;
        },

        /**
         * @return {number} Number of listeners attached to the Signal.
         */
        getNumListeners : function () {
            return this._bindings.length;
        },

        /**
         * Stop propagation of the event, blocking the dispatch to next listeners on the queue.
         * <p><strong>IMPORTANT:</strong> should be called only during signal dispatch, calling it before/after dispatch won't affect signal broadcast.</p>
         * @see Signal.prototype.disable
         */
        halt : function () {
            this._shouldPropagate = false;
        },

        /**
         * Dispatch/Broadcast Signal to all listeners added to the queue.
         * @param {...*} [params] Parameters that should be passed to each handler.
         */
        dispatch : function (params) {
            if (! this.active) {
                return;
            }

            var paramsArr = Array.prototype.slice.call(arguments),
                n = this._bindings.length,
                bindings;

            if (this.memorize) {
                this._prevParams = paramsArr;
            }

            if (! n) {
                //should come after memorize
                return;
            }

            bindings = this._bindings.slice(); //clone array in case add/remove items during dispatch
            this._shouldPropagate = true; //in case `halt` was called before dispatch or during the previous dispatch.

            //execute all callbacks until end of the list or until a callback returns `false` or stops propagation
            //reverse loop since listeners with higher priority will be added at the end of the list
            do { n--; } while (bindings[n] && this._shouldPropagate && bindings[n].execute(paramsArr) !== false);
        },

        /**
         * Forget memorized arguments.
         * @see Signal.memorize
         */
        forget : function(){
            this._prevParams = null;
        },

        /**
         * Remove all bindings from signal and destroy any reference to external objects (destroy Signal object).
         * <p><strong>IMPORTANT:</strong> calling any method on the signal instance after calling dispose will throw errors.</p>
         */
        dispose : function () {
            this.removeAll();
            delete this._bindings;
            delete this._prevParams;
        },

        /**
         * @return {string} String representation of the object.
         */
        toString : function () {
            return '[Signal active:'+ this.active +' numListeners:'+ this.getNumListeners() +']';
        }

    };


    // Namespace -----------------------------------------------------
    //================================================================

    /**
     * Signals namespace
     * @namespace
     * @name signals
     */
    var signals = Signal;

    /**
     * Custom event broadcaster
     * @see Signal
     */
    // alias for backwards compatibility (see #gh-44)
    signals.Signal = Signal;



    //exports to multiple environments
    if(typeof define === 'function' && define.amd){ //AMD
        define(function () { return signals; });
    } else if (typeof module !== 'undefined' && module.exports){ //node
        module.exports = signals;
    } else { //browser
        //use string because of Google closure compiler ADVANCED_MODE
        /*jslint sub:true */
        global['signals'] = signals;
    }

}(this));

},{}],14:[function(require,module,exports){
function hasGetterOrSetter(def) {
	return (!!def.get && typeof def.get === "function") || (!!def.set && typeof def.set === "function");
}

function getProperty(definition, k, isClassDescriptor) {
	//This may be a lightweight object, OR it might be a property
	//that was defined previously.
	
	//For simple class descriptors we can just assume its NOT previously defined.
	var def = isClassDescriptor 
				? definition[k] 
				: Object.getOwnPropertyDescriptor(definition, k);

	if (!isClassDescriptor && def.value && typeof def.value === "object") {
		def = def.value;
	}


	//This might be a regular property, or it may be a getter/setter the user defined in a class.
	if ( def && hasGetterOrSetter(def) ) {
		if (typeof def.enumerable === "undefined")
			def.enumerable = true;
		if (typeof def.configurable === "undefined")
			def.configurable = true;
		return def;
	} else {
		return false;
	}
}

function hasNonConfigurable(obj, k) {
	var prop = Object.getOwnPropertyDescriptor(obj, k);
	if (!prop)
		return false;

	if (prop.value && typeof prop.value === "object")
		prop = prop.value;

	if (prop.configurable === false) 
		return true;

	return false;
}

//TODO: On create, 
//		On mixin, 

function extend(ctor, definition, isClassDescriptor, extend) {
	for (var k in definition) {
		if (!definition.hasOwnProperty(k))
			continue;

		var def = getProperty(definition, k, isClassDescriptor);

		if (def !== false) {
			//If Extends is used, we will check its prototype to see if 
			//the final variable exists.
			
			var parent = extend || ctor;
			if (hasNonConfigurable(parent.prototype, k)) {

				//just skip the final property
				if (Class.ignoreFinals)
					continue;

				//We cannot re-define a property that is configurable=false.
				//So we will consider them final and throw an error. This is by
				//default so it is clear to the developer what is happening.
				//You can set ignoreFinals to true if you need to extend a class
				//which has configurable=false; it will simply not re-define final properties.
				throw new Error("cannot override final property '"+k
							+"', set Class.ignoreFinals = true to skip");
			}

			Object.defineProperty(ctor.prototype, k, def);
		} else {
			ctor.prototype[k] = definition[k];
		}

	}
}

/**
 */
function mixin(myClass, mixins) {
	if (!mixins)
		return;

	if (!Array.isArray(mixins))
		mixins = [mixins];

	for (var i=0; i<mixins.length; i++) {
		extend(myClass, mixins[i].prototype || mixins[i]);
	}
}

/**
 * Creates a new class with the given descriptor.
 * The constructor, defined by the name `initialize`,
 * is an optional function. If unspecified, an anonymous
 * function will be used which calls the parent class (if
 * one exists). 
 *
 * You can also use `Extends` and `Mixins` to provide subclassing
 * and inheritance.
 *
 * @class  Class
 * @constructor
 * @param {Object} definition a dictionary of functions for the class
 * @example
 *
 * 		var MyClass = new Class({
 * 		
 * 			initialize: function() {
 * 				this.foo = 2.0;
 * 			},
 *
 * 			bar: function() {
 * 				return this.foo + 5;
 * 			}
 * 		});
 */
function Class(definition) {
	if (!definition)
		definition = {};

	//The variable name here dictates what we see in Chrome debugger
	var initialize;
	var Extends;

	if (definition.initialize) {
		if (typeof definition.initialize !== "function")
			throw new Error("initialize must be a function");
		initialize = definition.initialize;

		//Usually we should avoid "delete" in V8 at all costs.
		//However, its unlikely to make any performance difference
		//here since we only call this on class creation (i.e. not object creation).
		delete definition.initialize;
	} else {
		if (definition.Extends) {
			var base = definition.Extends;
			initialize = function () {
				base.apply(this, arguments);
			}; 
		} else {
			initialize = function () {}; 
		}
	}

	if (definition.Extends) {
		initialize.prototype = Object.create(definition.Extends.prototype);
		initialize.prototype.constructor = initialize;
		//for getOwnPropertyDescriptor to work, we need to act
		//directly on the Extends (or Mixin)
		Extends = definition.Extends;
		delete definition.Extends;
	} else {
		initialize.prototype.constructor = initialize;
	}

	//Grab the mixins, if they are specified...
	var mixins = null;
	if (definition.Mixins) {
		mixins = definition.Mixins;
		delete definition.Mixins;
	}

	//First, mixin if we can.
	mixin(initialize, mixins);

	//Now we grab the actual definition which defines the overrides.
	extend(initialize, definition, true, Extends);

	return initialize;
};

Class.extend = extend;
Class.mixin = mixin;
Class.ignoreFinals = false;

module.exports = Class;
},{}],15:[function(require,module,exports){
/*
 * raf.js
 * https://github.com/ngryman/raf.js
 *
 * original requestAnimationFrame polyfill by Erik Möller
 * inspired from paul_irish gist and post
 *
 * Copyright (c) 2013 ngryman
 * Licensed under the MIT license.
 */

(function(window) {
	var lastTime = 0,
		vendors = ['webkit', 'moz'],
		requestAnimationFrame = window.requestAnimationFrame,
		cancelAnimationFrame = window.cancelAnimationFrame,
		i = vendors.length;

	// try to un-prefix existing raf
	while (--i >= 0 && !requestAnimationFrame) {
		requestAnimationFrame = window[vendors[i] + 'RequestAnimationFrame'];
		cancelAnimationFrame = window[vendors[i] + 'CancelAnimationFrame'];
	}

	// polyfill with setTimeout fallback
	// heavily inspired from @darius gist mod: https://gist.github.com/paulirish/1579671#comment-837945
	if (!requestAnimationFrame || !cancelAnimationFrame) {
		requestAnimationFrame = function(callback) {
			var now = Date.now(), nextTime = Math.max(lastTime + 16, now);
			return setTimeout(function() {
				callback(lastTime = nextTime);
			}, nextTime - now);
		};

		cancelAnimationFrame = clearTimeout;
	}

	// export to window
	window.requestAnimationFrame = requestAnimationFrame;
	window.cancelAnimationFrame = cancelAnimationFrame;
}(window));
},{}],16:[function(require,module,exports){
//Since both brfs and script-tag demos use the same
//source, we can just define it here and require it

//include requestAnimationFrame polyfill
require('raf.js');

//kami includes
var WebGLContext  = require('kami').WebGLContext;
var Texture       = require('kami').Texture;
var SpriteBatch   = require('kami').SpriteBatch;
var ShaderProgram = require('kami').ShaderProgram;

//This should only be called once DOM has been loaded
module.exports = function(vertSrc, fragSrc) {
    var canvas = document.createElement("canvas");
    
    document.body.appendChild(canvas);    
    
    canvas.width = 150;
    canvas.height = 150;

    var context = new WebGLContext(canvas.width, canvas.height, canvas);

    //we will use SpriteBatch for simple quad rendering
    var batch = new SpriteBatch(context);   

    //since we are using SpriteBatch, it expects a texture
    //in our case we'll just use an empty transparent 1x1 texture.
    //Our shader will do all the pixel drawing.
    var tex0 = new Texture(context, 1, 1);

    var mouseX = 0, 
        mouseY = 0,
        time = 0;

    window.addEventListener("mousemove", function(ev) {
        mouseX = ev.pageX / canvas.width;
        mouseY = 1.0 - ev.pageY / canvas.height;
    }, true);

    var shader = new ShaderProgram(context, vertSrc, fragSrc);

    //sometimes the shader gives us useful warnings, even if it compiled successfully
    if (shader.log) 
        console.warn(shader.log);



    function render() {
        requestAnimationFrame(render);
        batch.shader = shader;

        batch.begin();
        shader.setUniformf("time", time+=0.01); 
        shader.setUniformf("mouse", mouseX, mouseY); 

        batch.draw(tex0, 0, 0, canvas.width, canvas.height);        

        batch.end();
    }   

    requestAnimationFrame(render);
}
},{"kami":11,"raf.js":15}],17:[function(require,module,exports){
var domready = require('domready');
var base = require('../base');
var fs = require('fs');

domready(function() {
    //Here is where we query the GLSL source
    //We use a browserify transform to decouple them from our JS/HTML source code
    //But the build step will inline them into our JS, so there are no extra HTTP requests
    var vert = "//incoming Position attribute from our SpriteBatch\nattribute vec2 Position;\nattribute vec4 Color;\nattribute vec2 TexCoord0;\nuniform vec2 u_projection;\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\nvoid main(void) {\n   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);\n   vTexCoord0 = TexCoord0;\n   vColor = Color;\n} "
    var frag = "#ifdef GL_ES\nprecision mediump float;\n#endif\n\n/**\n * This is a horribly unoptimized tech demo of some spotlight effects\n * in a fragment shader. :) \n *\n * by mattdesl \n */\n\nuniform float time;\nuniform vec2 mouse;\n\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\n#define PI 3.1416\n\nvoid main(void)\n{\n\tvec2 p = vec2(vTexCoord0.x, 1.0-vTexCoord0.y);\n\tp.x += 0.58;\n\tp.y -= 0.61;\n\tvec2 center = vec2(0.5, 0.5);\n\tfloat d = distance(p, center);\n\t\t\n\t//bluish tint from top left\n\tvec3 color = vec3(1.0-d*0.75) * vec3(0.33, 0.35, 0.5);\n\t\n\t//add some green near centre\n\tcolor += (1.0-distance(p, vec2(1.0, 0.0))*1.)*0.5 * vec3(0.35, 0.65, 0.45);\n\t\n\tvec3 lightColor = vec3(0.3, 0.45, 0.65);\n\t\n\tfor (int i=0; i<3; i++) {\n\t\t//direction of light\n\t\tfloat zr = sin(time*0.15*float(i))*0.5 - PI/3.0;\n\n\t\tvec3 dir = vec3(cos(zr), sin(zr), 0.0);\n\n\t\tdir.x += ((mouse.x*2.0-1.0)+1.0)*float(2-i);\n\t\tdir.y += ((mouse.y*2.0-1.0)-1.0)*float(2-i);\n\t\t\n\t\tp.x -= 0.02;\n\t\t\n\t\t//normalized spotlight vector\n\t\tvec3 SpotDir = normalize(dir);\n\t\t\n\t\t//\n\t\tvec3 attenuation = vec3(0.5, 7.0, 10.0);\n\t\tfloat shadow = 1.0 / (attenuation.x + (attenuation.y*d) + (attenuation.z*d*d));\n\n\t\tvec3 pos = vec3(p, 0.0);\n\t\tvec3 delta = normalize(pos - vec3(center, 0.0));\n\t\t\n\t\tfloat cosOuterCone = cos(radians(1.0));\n\t\tfloat cosInnerCone = cos(radians(15.0 + float(i*2)));\n\t\tfloat cosDirection = dot(delta, SpotDir);\n\t\t\n\t\t//light...\n\t\tcolor += smoothstep(cosInnerCone, cosOuterCone, cosDirection) * shadow * lightColor;\n\t}\n\tcolor += sin(time*0.5)*0.05;\n\tgl_FragColor = vec4(vec3(color), 1.0) * vColor;\n}"

    //run the base example
    base(vert, frag);
});
},{"../base":16,"domready":2,"fs":1}]},{},[17])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9fZW1wdHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvQmFzZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1Nwcml0ZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1RleHR1cmUuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvVGV4dHVyZVJlZ2lvbi5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9XZWJHTENvbnRleHQuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9GcmFtZUJ1ZmZlci5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL01lc2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9TaGFkZXJQcm9ncmFtLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbm9kZV9tb2R1bGVzL251bWJlci11dGlsL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbm9kZV9tb2R1bGVzL3NpZ25hbHMvZGlzdC9zaWduYWxzLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2tsYXNzZS9pbmRleC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9yYWYuanMvcmFmLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvc3JjL3NoYWRlcnMvYmFzZS5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL3NyYy9zaGFkZXJzL2JyZnMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaG1CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbbnVsbCwiLyohXG4gICogZG9tcmVhZHkgKGMpIER1c3RpbiBEaWF6IDIwMTIgLSBMaWNlbnNlIE1JVFxuICAqL1xuIWZ1bmN0aW9uIChuYW1lLCBkZWZpbml0aW9uKSB7XG4gIGlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnKSBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24oKVxuICBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiYgdHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcpIGRlZmluZShkZWZpbml0aW9uKVxuICBlbHNlIHRoaXNbbmFtZV0gPSBkZWZpbml0aW9uKClcbn0oJ2RvbXJlYWR5JywgZnVuY3Rpb24gKHJlYWR5KSB7XG5cbiAgdmFyIGZucyA9IFtdLCBmbiwgZiA9IGZhbHNlXG4gICAgLCBkb2MgPSBkb2N1bWVudFxuICAgICwgdGVzdEVsID0gZG9jLmRvY3VtZW50RWxlbWVudFxuICAgICwgaGFjayA9IHRlc3RFbC5kb1Njcm9sbFxuICAgICwgZG9tQ29udGVudExvYWRlZCA9ICdET01Db250ZW50TG9hZGVkJ1xuICAgICwgYWRkRXZlbnRMaXN0ZW5lciA9ICdhZGRFdmVudExpc3RlbmVyJ1xuICAgICwgb25yZWFkeXN0YXRlY2hhbmdlID0gJ29ucmVhZHlzdGF0ZWNoYW5nZSdcbiAgICAsIHJlYWR5U3RhdGUgPSAncmVhZHlTdGF0ZSdcbiAgICAsIGxvYWRlZFJneCA9IGhhY2sgPyAvXmxvYWRlZHxeYy8gOiAvXmxvYWRlZHxjL1xuICAgICwgbG9hZGVkID0gbG9hZGVkUmd4LnRlc3QoZG9jW3JlYWR5U3RhdGVdKVxuXG4gIGZ1bmN0aW9uIGZsdXNoKGYpIHtcbiAgICBsb2FkZWQgPSAxXG4gICAgd2hpbGUgKGYgPSBmbnMuc2hpZnQoKSkgZigpXG4gIH1cblxuICBkb2NbYWRkRXZlbnRMaXN0ZW5lcl0gJiYgZG9jW2FkZEV2ZW50TGlzdGVuZXJdKGRvbUNvbnRlbnRMb2FkZWQsIGZuID0gZnVuY3Rpb24gKCkge1xuICAgIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKGRvbUNvbnRlbnRMb2FkZWQsIGZuLCBmKVxuICAgIGZsdXNoKClcbiAgfSwgZilcblxuXG4gIGhhY2sgJiYgZG9jLmF0dGFjaEV2ZW50KG9ucmVhZHlzdGF0ZWNoYW5nZSwgZm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKC9eYy8udGVzdChkb2NbcmVhZHlTdGF0ZV0pKSB7XG4gICAgICBkb2MuZGV0YWNoRXZlbnQob25yZWFkeXN0YXRlY2hhbmdlLCBmbilcbiAgICAgIGZsdXNoKClcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIChyZWFkeSA9IGhhY2sgP1xuICAgIGZ1bmN0aW9uIChmbikge1xuICAgICAgc2VsZiAhPSB0b3AgP1xuICAgICAgICBsb2FkZWQgPyBmbigpIDogZm5zLnB1c2goZm4pIDpcbiAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB0ZXN0RWwuZG9TY3JvbGwoJ2xlZnQnKVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyByZWFkeShmbikgfSwgNTApXG4gICAgICAgICAgfVxuICAgICAgICAgIGZuKClcbiAgICAgICAgfSgpXG4gICAgfSA6XG4gICAgZnVuY3Rpb24gKGZuKSB7XG4gICAgICBsb2FkZWQgPyBmbigpIDogZm5zLnB1c2goZm4pXG4gICAgfSlcbn0pXG4iLCIvKipcbiAqIFRoZSBjb3JlIGthbWkgbW9kdWxlIHByb3ZpZGVzIGJhc2ljIDJEIHNwcml0ZSBiYXRjaGluZyBhbmQgXG4gKiBhc3NldCBtYW5hZ2VtZW50LlxuICogXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBNZXNoID0gcmVxdWlyZSgnLi9nbHV0aWxzL01lc2gnKTtcblxudmFyIGNvbG9yVG9GbG9hdCA9IHJlcXVpcmUoJ251bWJlci11dGlsJykuY29sb3JUb0Zsb2F0O1xuXG4vKiogXG4gKiBBIGJhdGNoZXIgbWl4aW4gY29tcG9zZWQgb2YgcXVhZHMgKHR3byB0cmlzLCBpbmRleGVkKS4gXG4gKlxuICogVGhpcyBpcyB1c2VkIGludGVybmFsbHk7IHVzZXJzIHNob3VsZCBsb29rIGF0IFxuICoge3sjY3Jvc3NMaW5rIFwiU3ByaXRlQmF0Y2hcIn19e3svY3Jvc3NMaW5rfX0gaW5zdGVhZCwgd2hpY2ggaW5oZXJpdHMgZnJvbSB0aGlzXG4gKiBjbGFzcy5cbiAqIFxuICogVGhlIGJhdGNoZXIgaXRzZWxmIGlzIG5vdCBtYW5hZ2VkIGJ5IFdlYkdMQ29udGV4dDsgaG93ZXZlciwgaXQgbWFrZXNcbiAqIHVzZSBvZiBNZXNoIGFuZCBUZXh0dXJlIHdoaWNoIHdpbGwgYmUgbWFuYWdlZC4gRm9yIHRoaXMgcmVhc29uLCB0aGUgYmF0Y2hlclxuICogZG9lcyBub3QgaG9sZCBhIGRpcmVjdCByZWZlcmVuY2UgdG8gdGhlIEdMIHN0YXRlLlxuICpcbiAqIFN1YmNsYXNzZXMgbXVzdCBpbXBsZW1lbnQgdGhlIGZvbGxvd2luZzogIFxuICoge3sjY3Jvc3NMaW5rIFwiQmFzZUJhdGNoL19jcmVhdGVTaGFkZXI6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9fY3JlYXRlVmVydGV4QXR0cmlidXRlczptZXRob2RcIn19e3svY3Jvc3NMaW5rfX0gIFxuICoge3sjY3Jvc3NMaW5rIFwiQmFzZUJhdGNoL2dldFZlcnRleFNpemU6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319ICBcbiAqIFxuICogQGNsYXNzICBCYXNlQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIGNvbnRleHQgdGhpcyBiYXRjaGVyIGJlbG9uZ3MgdG9cbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBvcHRpb25hbCBzaXplIG9mIHRoaXMgYmF0Y2gsIGkuZS4gbWF4IG51bWJlciBvZiBxdWFkc1xuICogQGRlZmF1bHQgIDUwMFxuICovXG52YXIgQmFzZUJhdGNoID0gbmV3IENsYXNzKHtcblxuXHQvL0NvbnN0cnVjdG9yXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIEJhc2VCYXRjaChjb250ZXh0LCBzaXplKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gU3ByaXRlQmF0Y2hcIjtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0dGhpcy5zaXplID0gc2l6ZSB8fCA1MDA7XG5cdFx0XG5cdFx0Ly8gNjU1MzUgaXMgbWF4IGluZGV4LCBzbyA2NTUzNSAvIDYgPSAxMDkyMi5cblx0XHRpZiAodGhpcy5zaXplID4gMTA5MjIpICAvLyh5b3UnZCBoYXZlIHRvIGJlIGluc2FuZSB0byB0cnkgYW5kIGJhdGNoIHRoaXMgbXVjaCB3aXRoIFdlYkdMKVxuXHRcdFx0dGhyb3cgXCJDYW4ndCBoYXZlIG1vcmUgdGhhbiAxMDkyMiBzcHJpdGVzIHBlciBiYXRjaDogXCIgKyB0aGlzLnNpemU7XG5cdFx0XHRcdFxuXHRcdFxuXHRcdFxuXHRcdHRoaXMuX2JsZW5kU3JjID0gdGhpcy5jb250ZXh0LmdsLk9ORTtcblx0XHR0aGlzLl9ibGVuZERzdCA9IHRoaXMuY29udGV4dC5nbC5PTkVfTUlOVVNfU1JDX0FMUEhBXG5cdFx0dGhpcy5fYmxlbmRpbmdFbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLl9zaGFkZXIgPSB0aGlzLl9jcmVhdGVTaGFkZXIoKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoaXMgc2hhZGVyIHdpbGwgYmUgdXNlZCB3aGVuZXZlciBcIm51bGxcIiBpcyBwYXNzZWRcblx0XHQgKiBhcyB0aGUgYmF0Y2gncyBzaGFkZXIuIFxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHtTaGFkZXJQcm9ncmFtfSBzaGFkZXJcblx0XHQgKi9cblx0XHR0aGlzLmRlZmF1bHRTaGFkZXIgPSB0aGlzLl9zaGFkZXI7XG5cblx0XHQvKipcblx0XHQgKiBCeSBkZWZhdWx0LCBhIFNwcml0ZUJhdGNoIGlzIGNyZWF0ZWQgd2l0aCBpdHMgb3duIFNoYWRlclByb2dyYW0sXG5cdFx0ICogc3RvcmVkIGluIGBkZWZhdWx0U2hhZGVyYC4gSWYgdGhpcyBmbGFnIGlzIHRydWUsIG9uIGRlbGV0aW5nIHRoZSBTcHJpdGVCYXRjaCwgaXRzXG5cdFx0ICogYGRlZmF1bHRTaGFkZXJgIHdpbGwgYWxzbyBiZSBkZWxldGVkLiBJZiB0aGlzIGZsYWcgaXMgZmFsc2UsIG5vIHNoYWRlcnNcblx0XHQgKiB3aWxsIGJlIGRlbGV0ZWQgb24gZGVzdHJveS5cblx0XHQgKlxuXHRcdCAqIE5vdGUgdGhhdCBpZiB5b3UgcmUtYXNzaWduIGBkZWZhdWx0U2hhZGVyYCwgeW91IHdpbGwgbmVlZCB0byBkaXNwb3NlIHRoZSBwcmV2aW91c1xuXHRcdCAqIGRlZmF1bHQgc2hhZGVyIHlvdXJzZWwuIFxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IG93bnNTaGFkZXJcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKi9cblx0XHR0aGlzLm93bnNTaGFkZXIgPSB0cnVlO1xuXG5cdFx0dGhpcy5pZHggPSAwO1xuXG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcgdG8gdGhlIGJhdGNoLiBEbyBub3QgbW9kaWZ5LlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gZHJhd2luZ1xuXHRcdCAqL1xuXHRcdHRoaXMuZHJhd2luZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5tZXNoID0gdGhpcy5fY3JlYXRlTWVzaCh0aGlzLnNpemUpO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaGUgQUJHUiBwYWNrZWQgY29sb3IsIGFzIGEgc2luZ2xlIGZsb2F0LiBUaGUgZGVmYXVsdFxuXHRcdCAqIHZhbHVlIGlzIHRoZSBjb2xvciB3aGl0ZSAoMjU1LCAyNTUsIDI1NSwgMjU1KS5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBjb2xvclxuXHRcdCAqIEByZWFkT25seSBcblx0XHQgKi9cblx0XHR0aGlzLmNvbG9yID0gY29sb3JUb0Zsb2F0KDI1NSwgMjU1LCAyNTUsIDI1NSk7XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciB0byBwcmVtdWx0aXBseSBhbHBoYSBvbiBjYWxscyB0byBzZXRDb2xvci4gXG5cdFx0ICogVGhpcyBpcyB0cnVlIGJ5IGRlZmF1bHQsIHNvIHRoYXQgd2UgY2FuIGNvbnZlbmllbnRseSB3cml0ZTpcblx0XHQgKlxuXHRcdCAqICAgICBiYXRjaC5zZXRDb2xvcigxLCAwLCAwLCAwLjI1KTsgLy90aW50cyByZWQgd2l0aCAyNSUgb3BhY2l0eVxuXHRcdCAqXG5cdFx0ICogSWYgZmFsc2UsIHlvdSBtdXN0IHByZW11bHRpcGx5IHRoZSBjb2xvcnMgeW91cnNlbGYgdG8gYWNoaWV2ZVxuXHRcdCAqIHRoZSBzYW1lIHRpbnQsIGxpa2Ugc286XG5cdFx0ICpcblx0XHQgKiAgICAgYmF0Y2guc2V0Q29sb3IoMC4yNSwgMCwgMCwgMC4yNSk7XG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHByZW11bHRpcGxpZWRcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKiBAZGVmYXVsdCAgdHJ1ZVxuXHRcdCAqL1xuXHRcdHRoaXMucHJlbXVsdGlwbGllZCA9IHRydWU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgcHJvcGVydHkgdG8gZW5hYmxlIG9yIGRpc2FibGUgYmxlbmRpbmcgZm9yIHRoaXMgc3ByaXRlIGJhdGNoLiBJZlxuXHQgKiB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcsIHRoaXMgd2lsbCBmaXJzdCBmbHVzaCB0aGUgYmF0Y2gsIGFuZCB0aGVuXG5cdCAqIHVwZGF0ZSBHTF9CTEVORCBzdGF0ZSAoZW5hYmxlZCBvciBkaXNhYmxlZCkgd2l0aCBvdXIgbmV3IHZhbHVlLlxuXHQgKiBcblx0ICogQHByb3BlcnR5IHtCb29sZWFufSBibGVuZGluZ0VuYWJsZWRcblx0ICovXG5cdGJsZW5kaW5nRW5hYmxlZDoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHR2YXIgb2xkID0gdGhpcy5fYmxlbmRpbmdFbmFibGVkO1xuXHRcdFx0aWYgKHRoaXMuZHJhd2luZylcblx0XHRcdFx0dGhpcy5mbHVzaCgpO1xuXG5cdFx0XHR0aGlzLl9ibGVuZGluZ0VuYWJsZWQgPSB2YWw7XG5cblx0XHRcdC8vaWYgd2UgaGF2ZSBhIG5ldyB2YWx1ZSwgdXBkYXRlIGl0LlxuXHRcdFx0Ly90aGlzIGlzIGJlY2F1c2UgYmxlbmQgaXMgZG9uZSBpbiBiZWdpbigpIC8gZW5kKCkgXG5cdFx0XHRpZiAodGhpcy5kcmF3aW5nICYmIG9sZCAhPSB2YWwpIHtcblx0XHRcdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFx0XHRpZiAodmFsKVxuXHRcdFx0XHRcdGdsLmVuYWJsZShnbC5CTEVORCk7XG5cdFx0XHRcdGVsc2Vcblx0XHRcdFx0XHRnbC5kaXNhYmxlKGdsLkJMRU5EKTtcblx0XHRcdH1cblxuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JsZW5kaW5nRW5hYmxlZDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGJsZW5kIHNvdXJjZSBwYXJhbWV0ZXJzLiBcblx0ICogSWYgd2UgYXJlIGN1cnJlbnRseSBkcmF3aW5nLCB0aGlzIHdpbGwgZmx1c2ggdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBTZXR0aW5nIGVpdGhlciBzcmMgb3IgZHN0IHRvIGBudWxsYCBvciBhIGZhbHN5IHZhbHVlIHRlbGxzIHRoZSBTcHJpdGVCYXRjaFxuXHQgKiB0byBpZ25vcmUgZ2wuYmxlbmRGdW5jLiBUaGlzIGlzIHVzZWZ1bCBpZiB5b3Ugd2lzaCB0byB1c2UgeW91clxuXHQgKiBvd24gYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlLiBcblx0ICogXG5cdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSBibGVuZERzdCBcblx0ICovXG5cdGJsZW5kU3JjOiB7XG5cdFx0c2V0OiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdGlmICh0aGlzLmRyYXdpbmcpXG5cdFx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMuX2JsZW5kU3JjID0gdmFsO1xuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JsZW5kU3JjO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgYmxlbmQgZGVzdGluYXRpb24gcGFyYW1ldGVycy4gXG5cdCAqIElmIHdlIGFyZSBjdXJyZW50bHkgZHJhd2luZywgdGhpcyB3aWxsIGZsdXNoIHRoZSBiYXRjaC5cblx0ICpcblx0ICogU2V0dGluZyBlaXRoZXIgc3JjIG9yIGRzdCB0byBgbnVsbGAgb3IgYSBmYWxzeSB2YWx1ZSB0ZWxscyB0aGUgU3ByaXRlQmF0Y2hcblx0ICogdG8gaWdub3JlIGdsLmJsZW5kRnVuYy4gVGhpcyBpcyB1c2VmdWwgaWYgeW91IHdpc2ggdG8gdXNlIHlvdXJcblx0ICogb3duIGJsZW5kRnVuYyBvciBibGVuZEZ1bmNTZXBhcmF0ZS4gXG5cdCAqXG5cdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSBibGVuZFNyYyBcblx0ICovXG5cdGJsZW5kRHN0OiB7XG5cdFx0c2V0OiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdGlmICh0aGlzLmRyYXdpbmcpXG5cdFx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMuX2JsZW5kRHN0ID0gdmFsO1xuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2JsZW5kRHN0O1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgYmxlbmQgc291cmNlIGFuZCBkZXN0aW5hdGlvbiBwYXJhbWV0ZXJzLiBUaGlzIGlzIFxuXHQgKiBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIGZvciB0aGUgYmxlbmRTcmMgYW5kIGJsZW5kRHN0IHNldHRlcnMuXG5cdCAqIElmIHdlIGFyZSBjdXJyZW50bHkgZHJhd2luZywgdGhpcyB3aWxsIGZsdXNoIHRoZSBiYXRjaC5cblx0ICpcblx0ICogU2V0dGluZyBlaXRoZXIgdG8gYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgdGVsbHMgdGhlIFNwcml0ZUJhdGNoXG5cdCAqIHRvIGlnbm9yZSBnbC5ibGVuZEZ1bmMuIFRoaXMgaXMgdXNlZnVsIGlmIHlvdSB3aXNoIHRvIHVzZSB5b3VyXG5cdCAqIG93biBibGVuZEZ1bmMgb3IgYmxlbmRGdW5jU2VwYXJhdGUuIFxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRCbGVuZEZ1bmN0aW9uXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBibGVuZFNyYyB0aGUgc291cmNlIGJsZW5kIHBhcmFtZXRlclxuXHQgKiBAcGFyYW0ge0dMZW51bX0gYmxlbmREc3QgdGhlIGRlc3RpbmF0aW9uIGJsZW5kIHBhcmFtZXRlclxuXHQgKi9cblx0c2V0QmxlbmRGdW5jdGlvbjogZnVuY3Rpb24oYmxlbmRTcmMsIGJsZW5kRHN0KSB7XG5cdFx0dGhpcy5ibGVuZFNyYyA9IGJsZW5kU3JjO1xuXHRcdHRoaXMuYmxlbmREc3QgPSBibGVuZERzdDtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIHNldHRlci9nZXR0ZXIgZm9yIHRoaXMgYmF0Y2gncyBjdXJyZW50IFNoYWRlclByb2dyYW0uXG5cdCAqIElmIHRoaXMgaXMgc2V0IHdoZW4gdGhlIGJhdGNoIGlzIGRyYXdpbmcsIHRoZSBzdGF0ZSB3aWxsIGJlIGZsdXNoZWRcblx0ICogdG8gdGhlIEdQVSBhbmQgdGhlIG5ldyBzaGFkZXIgd2lsbCB0aGVuIGJlIGJvdW5kLlxuXHQgKlxuXHQgKiBJZiBgbnVsbGAgb3IgYSBmYWxzeSB2YWx1ZSBpcyBzcGVjaWZpZWQsIHRoZSBiYXRjaCdzIGBkZWZhdWx0U2hhZGVyYCB3aWxsIGJlIHVzZWQuIFxuXHQgKlxuXHQgKiBOb3RlIHRoYXQgc2hhZGVycyBhcmUgYm91bmQgb24gYmF0Y2guYmVnaW4oKS5cblx0ICpcblx0ICogQHByb3BlcnR5IHNoYWRlclxuXHQgKiBAdHlwZSB7U2hhZGVyUHJvZ3JhbX1cblx0ICovXG5cdHNoYWRlcjoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHR2YXIgd2FzRHJhd2luZyA9IHRoaXMuZHJhd2luZztcblxuXHRcdFx0aWYgKHdhc0RyYXdpbmcpIHtcblx0XHRcdFx0dGhpcy5lbmQoKTsgLy91bmJpbmRzIHRoZSBzaGFkZXIgZnJvbSB0aGUgbWVzaFxuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9zaGFkZXIgPSB2YWwgPyB2YWwgOiB0aGlzLmRlZmF1bHRTaGFkZXI7XG5cblx0XHRcdGlmICh3YXNEcmF3aW5nKSB7XG5cdFx0XHRcdHRoaXMuYmVnaW4oKTtcblx0XHRcdH1cblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9zaGFkZXI7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBjb2xvciBvZiB0aGlzIHNwcml0ZSBiYXRjaGVyLCB3aGljaCBpcyB1c2VkIGluIHN1YnNlcXVlbnQgZHJhd1xuXHQgKiBjYWxscy4gVGhpcyBkb2VzIG5vdCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIElmIHIsIGcsIGIsIGFyZSBhbGwgbnVtYmVycywgdGhpcyBtZXRob2QgYXNzdW1lcyB0aGF0IFJHQiBcblx0ICogb3IgUkdCQSBmbG9hdCB2YWx1ZXMgKDAuMCB0byAxLjApIGFyZSBiZWluZyBwYXNzZWQuIEFscGhhIGRlZmF1bHRzIHRvIG9uZVxuXHQgKiBpZiB1bmRlZmluZWQuXG5cdCAqIFxuXHQgKiBJZiB0aGUgZmlyc3QgdGhyZWUgYXJndW1lbnRzIGFyZSBub3QgbnVtYmVycywgd2Ugb25seSBjb25zaWRlciB0aGUgZmlyc3QgYXJndW1lbnRcblx0ICogYW5kIGFzc2lnbiBpdCB0byBhbGwgZm91ciBjb21wb25lbnRzIC0tIHRoaXMgaXMgdXNlZnVsIGZvciBzZXR0aW5nIHRyYW5zcGFyZW5jeSBcblx0ICogaW4gYSBwcmVtdWx0aXBsaWVkIGFscGhhIHN0YWdlLiBcblx0ICogXG5cdCAqIElmIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBpbnZhbGlkIG9yIG5vdCBhIG51bWJlcixcblx0ICogdGhlIGNvbG9yIGRlZmF1bHRzIHRvICgxLCAxLCAxLCAxKS5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0Q29sb3Jcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHIgdGhlIHJlZCBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGcgdGhlIGdyZWVuIGNvbXBvbmVudCwgbm9ybWFsaXplZFxuXHQgKiBAcGFyYW0ge051bWJlcn0gYiB0aGUgYmx1ZSBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGEgdGhlIGFscGhhIGNvbXBvbmVudCwgbm9ybWFsaXplZFxuXHQgKi9cblx0c2V0Q29sb3I6IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0XHR2YXIgcm51bSA9IHR5cGVvZiByID09PSBcIm51bWJlclwiO1xuXHRcdGlmIChybnVtXG5cdFx0XHRcdCYmIHR5cGVvZiBnID09PSBcIm51bWJlclwiXG5cdFx0XHRcdCYmIHR5cGVvZiBiID09PSBcIm51bWJlclwiKSB7XG5cdFx0XHQvL2RlZmF1bHQgYWxwaGEgdG8gb25lIFxuXHRcdFx0YSA9IChhIHx8IGEgPT09IDApID8gYSA6IDEuMDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ciA9IGcgPSBiID0gYSA9IHJudW0gPyByIDogMS4wO1xuXHRcdH1cblx0XHRcblx0XHRpZiAodGhpcy5wcmVtdWx0aXBsaWVkKSB7XG5cdFx0XHRyICo9IGE7XG5cdFx0XHRnICo9IGE7XG5cdFx0XHRiICo9IGE7XG5cdFx0fVxuXHRcdFxuXHRcdHRoaXMuY29sb3IgPSBjb2xvclRvRmxvYXQoXG5cdFx0XHR+fihyICogMjU1KSxcblx0XHRcdH5+KGcgKiAyNTUpLFxuXHRcdFx0fn4oYiAqIDI1NSksXG5cdFx0XHR+fihhICogMjU1KVxuXHRcdCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxlZCBmcm9tIHRoZSBjb25zdHJ1Y3RvciB0byBjcmVhdGUgYSBuZXcgTWVzaCBcblx0ICogYmFzZWQgb24gdGhlIGV4cGVjdGVkIGJhdGNoIHNpemUuIFNob3VsZCBzZXQgdXBcblx0ICogdmVydHMgJiBpbmRpY2VzIHByb3Blcmx5LlxuXHQgKlxuXHQgKiBVc2VycyBzaG91bGQgbm90IGNhbGwgdGhpcyBkaXJlY3RseTsgaW5zdGVhZCwgaXRcblx0ICogc2hvdWxkIG9ubHkgYmUgaW1wbGVtZW50ZWQgYnkgc3ViY2xhc3Nlcy5cblx0ICogXG5cdCAqIEBtZXRob2QgX2NyZWF0ZU1lc2hcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgdGhlIHNpemUgcGFzc2VkIHRocm91Z2ggdGhlIGNvbnN0cnVjdG9yXG5cdCAqL1xuXHRfY3JlYXRlTWVzaDogZnVuY3Rpb24oc2l6ZSkge1xuXHRcdC8vdGhlIHRvdGFsIG51bWJlciBvZiBmbG9hdHMgaW4gb3VyIGJhdGNoXG5cdFx0dmFyIG51bVZlcnRzID0gc2l6ZSAqIDQgKiB0aGlzLmdldFZlcnRleFNpemUoKTtcblx0XHQvL3RoZSB0b3RhbCBudW1iZXIgb2YgaW5kaWNlcyBpbiBvdXIgYmF0Y2hcblx0XHR2YXIgbnVtSW5kaWNlcyA9IHNpemUgKiA2O1xuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblxuXHRcdC8vdmVydGV4IGRhdGFcblx0XHR0aGlzLnZlcnRpY2VzID0gbmV3IEZsb2F0MzJBcnJheShudW1WZXJ0cyk7XG5cdFx0Ly9pbmRleCBkYXRhXG5cdFx0dGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KG51bUluZGljZXMpOyBcblx0XHRcblx0XHRmb3IgKHZhciBpPTAsIGo9MDsgaSA8IG51bUluZGljZXM7IGkgKz0gNiwgaiArPSA0KSBcblx0XHR7XG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDBdID0gaiArIDA7IFxuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAxXSA9IGogKyAxO1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAyXSA9IGogKyAyO1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAzXSA9IGogKyAwO1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyA0XSA9IGogKyAyO1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyA1XSA9IGogKyAzO1xuXHRcdH1cblxuXHRcdHZhciBtZXNoID0gbmV3IE1lc2godGhpcy5jb250ZXh0LCBmYWxzZSwgXG5cdFx0XHRcdFx0XHRudW1WZXJ0cywgbnVtSW5kaWNlcywgdGhpcy5fY3JlYXRlVmVydGV4QXR0cmlidXRlcygpKTtcblx0XHRtZXNoLnZlcnRpY2VzID0gdGhpcy52ZXJ0aWNlcztcblx0XHRtZXNoLmluZGljZXMgPSB0aGlzLmluZGljZXM7XG5cdFx0bWVzaC52ZXJ0ZXhVc2FnZSA9IGdsLkRZTkFNSUNfRFJBVztcblx0XHRtZXNoLmluZGV4VXNhZ2UgPSBnbC5TVEFUSUNfRFJBVztcblx0XHRtZXNoLmRpcnR5ID0gdHJ1ZTtcblx0XHRyZXR1cm4gbWVzaDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyBhIHNoYWRlciBmb3IgdGhpcyBiYXRjaC4gSWYgeW91IHBsYW4gdG8gc3VwcG9ydFxuXHQgKiBtdWx0aXBsZSBpbnN0YW5jZXMgb2YgeW91ciBiYXRjaCwgaXQgbWF5IG9yIG1heSBub3QgYmUgd2lzZVxuXHQgKiB0byB1c2UgYSBzaGFyZWQgc2hhZGVyIHRvIHNhdmUgcmVzb3VyY2VzLlxuXHQgKiBcblx0ICogVGhpcyBtZXRob2QgaW5pdGlhbGx5IHRocm93cyBhbiBlcnJvcjsgc28gaXQgbXVzdCBiZSBvdmVycmlkZGVuIGJ5XG5cdCAqIHN1YmNsYXNzZXMgb2YgQmFzZUJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfY3JlYXRlU2hhZGVyXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIHNpemUgb2YgYSB2ZXJ0ZXgsIGluICMgb2YgZmxvYXRzXG5cdCAqL1xuXHRfY3JlYXRlU2hhZGVyOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcIl9jcmVhdGVTaGFkZXIgbm90IGltcGxlbWVudGVkXCJcblx0fSxcdFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIHZlcnRleCBhdHRyaWJ1dGVzIGZvciB0aGlzIG1lc2g7IFxuXHQgKiBzdWJjbGFzc2VzIHNob3VsZCBpbXBsZW1lbnQgdGhpcyB3aXRoIHRoZSBhdHRyaWJ1dGVzIFxuXHQgKiBleHBlY3RlZCBmb3IgdGhlaXIgYmF0Y2guXG5cdCAqXG5cdCAqIFRoaXMgbWV0aG9kIGluaXRpYWxseSB0aHJvd3MgYW4gZXJyb3I7IHNvIGl0IG11c3QgYmUgb3ZlcnJpZGRlbiBieVxuXHQgKiBzdWJjbGFzc2VzIG9mIEJhc2VCYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCBfY3JlYXRlVmVydGV4QXR0cmlidXRlc1xuXHQgKiBAcmV0dXJuIHtBcnJheX0gYW4gYXJyYXkgb2YgTWVzaC5WZXJ0ZXhBdHRyaWIgb2JqZWN0c1xuXHQgKi9cblx0X2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuXHRcdHRocm93IFwiX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXMgbm90IGltcGxlbWVudGVkXCI7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4IGZvciB0aGlzIGJhdGNoZXIuXG5cdCAqIFxuXHQgKiBUaGlzIG1ldGhvZCBpbml0aWFsbHkgdGhyb3dzIGFuIGVycm9yOyBzbyBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYnlcblx0ICogc3ViY2xhc3NlcyBvZiBCYXNlQmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFZlcnRleFNpemVcblx0ICogQHJldHVybiB7TnVtYmVyfSB0aGUgc2l6ZSBvZiBhIHZlcnRleCwgaW4gIyBvZiBmbG9hdHNcblx0ICovXG5cdGdldFZlcnRleFNpemU6IGZ1bmN0aW9uKCkge1xuXHRcdHRocm93IFwiZ2V0VmVydGV4U2l6ZSBub3QgaW1wbGVtZW50ZWRcIjtcblx0fSxcblxuXHRcblx0LyoqIFxuXHQgKiBCZWdpbnMgdGhlIHNwcml0ZSBiYXRjaC4gVGhpcyB3aWxsIGJpbmQgdGhlIHNoYWRlclxuXHQgKiBhbmQgbWVzaC4gU3ViY2xhc3NlcyBtYXkgd2FudCB0byBkaXNhYmxlIGRlcHRoIG9yIFxuXHQgKiBzZXQgdXAgYmxlbmRpbmcuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGJlZ2luXG5cdCAqL1xuXHRiZWdpbjogZnVuY3Rpb24oKSAge1xuXHRcdGlmICh0aGlzLmRyYXdpbmcpIFxuXHRcdFx0dGhyb3cgXCJiYXRjaC5lbmQoKSBtdXN0IGJlIGNhbGxlZCBiZWZvcmUgYmVnaW5cIjtcblx0XHR0aGlzLmRyYXdpbmcgPSB0cnVlO1xuXG5cdFx0dGhpcy5zaGFkZXIuYmluZCgpO1xuXG5cdFx0Ly9iaW5kIHRoZSBhdHRyaWJ1dGVzIG5vdyB0byBhdm9pZCByZWR1bmRhbnQgY2FsbHNcblx0XHR0aGlzLm1lc2guYmluZCh0aGlzLnNoYWRlcik7XG5cblx0XHRpZiAodGhpcy5fYmxlbmRpbmdFbmFibGVkKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XHRnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXHRcdH1cblx0fSxcblxuXHQvKiogXG5cdCAqIEVuZHMgdGhlIHNwcml0ZSBiYXRjaC4gVGhpcyB3aWxsIGZsdXNoIGFueSByZW1haW5pbmcgXG5cdCAqIGRhdGEgYW5kIHNldCBHTCBzdGF0ZSBiYWNrIHRvIG5vcm1hbC5cblx0ICogXG5cdCAqIEBtZXRob2QgIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpICB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcImJhdGNoLmJlZ2luKCkgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIGVuZFwiO1xuXHRcdGlmICh0aGlzLmlkeCA+IDApXG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0dGhpcy5kcmF3aW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLm1lc2gudW5iaW5kKHRoaXMuc2hhZGVyKTtcblxuXHRcdGlmICh0aGlzLl9ibGVuZGluZ0VuYWJsZWQpIHtcblx0XHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcdGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuXHRcdH1cblx0fSxcblxuXHQvKiogXG5cdCAqIENhbGxlZCBiZWZvcmUgcmVuZGVyaW5nIHRvIGJpbmQgbmV3IHRleHR1cmVzLlxuXHQgKiBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgYnkgZGVmYXVsdC5cblx0ICpcblx0ICogQG1ldGhvZCAgX3ByZVJlbmRlclxuXHQgKi9cblx0X3ByZVJlbmRlcjogZnVuY3Rpb24oKSAge1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGbHVzaGVzIHRoZSBiYXRjaCBieSBwdXNoaW5nIHRoZSBjdXJyZW50IGRhdGFcblx0ICogdG8gR0wuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGZsdXNoXG5cdCAqL1xuXHRmbHVzaDogZnVuY3Rpb24oKSAge1xuXHRcdGlmICh0aGlzLmlkeD09PTApXG5cdFx0XHRyZXR1cm47XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHQvL3ByZW11bHRpcGxpZWQgYWxwaGFcblx0XHRpZiAodGhpcy5fYmxlbmRpbmdFbmFibGVkKSB7XG5cdFx0XHQvL3NldCBlaXRoZXIgdG8gbnVsbCBpZiB5b3Ugd2FudCB0byBjYWxsIHlvdXIgb3duIFxuXHRcdFx0Ly9ibGVuZEZ1bmMgb3IgYmxlbmRGdW5jU2VwYXJhdGVcblx0XHRcdGlmICh0aGlzLl9ibGVuZFNyYyAmJiB0aGlzLl9ibGVuZERzdClcblx0XHRcdFx0Z2wuYmxlbmRGdW5jKHRoaXMuX2JsZW5kU3JjLCB0aGlzLl9ibGVuZERzdCk7IFxuXHRcdH1cblxuXHRcdHRoaXMuX3ByZVJlbmRlcigpO1xuXG5cdFx0Ly9udW1iZXIgb2Ygc3ByaXRlcyBpbiBiYXRjaFxuXHRcdHZhciBudW1Db21wb25lbnRzID0gdGhpcy5nZXRWZXJ0ZXhTaXplKCk7XG5cdFx0dmFyIHNwcml0ZUNvdW50ID0gKHRoaXMuaWR4IC8gKG51bUNvbXBvbmVudHMgKiA0KSk7XG5cdFx0XG5cdFx0Ly9kcmF3IHRoZSBzcHJpdGVzXG5cdFx0dGhpcy5tZXNoLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMubWVzaC5kcmF3KGdsLlRSSUFOR0xFUywgc3ByaXRlQ291bnQgKiA2LCAwLCB0aGlzLmlkeCk7XG5cblx0XHR0aGlzLmlkeCA9IDA7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzcHJpdGUgdG8gdGhpcyBiYXRjaC5cblx0ICogVGhlIHNwZWNpZmljcyBkZXBlbmQgb24gdGhlIHNwcml0ZSBiYXRjaCBpbXBsZW1lbnRhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCBkcmF3XG5cdCAqIEBwYXJhbSAge1RleHR1cmV9IHRleHR1cmUgdGhlIHRleHR1cmUgZm9yIHRoaXMgc3ByaXRlXG5cdCAqIEBwYXJhbSAge051bWJlcn0geCAgICAgICB0aGUgeCBwb3NpdGlvbiwgZGVmYXVsdHMgdG8gemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHkgICAgICAgdGhlIHkgcG9zaXRpb24sIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgIHRoZSB3aWR0aCwgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgd2lkdGhcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgIHRoZSBoZWlnaHQsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIGhlaWdodFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUxICAgICAgdGhlIGZpcnN0IFUgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjEgICAgICB0aGUgZmlyc3QgViBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MiAgICAgIHRoZSBzZWNvbmQgVSBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYyICAgICAgdGhlIHNlY29uZCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqL1xuXHRkcmF3OiBmdW5jdGlvbih0ZXh0dXJlLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCB1MSwgdjEsIHUyLCB2Mikge1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc2luZ2xlIHF1YWQgbWVzaCB0byB0aGlzIHNwcml0ZSBiYXRjaCBmcm9tIHRoZSBnaXZlblxuXHQgKiBhcnJheSBvZiB2ZXJ0aWNlcy5cblx0ICogVGhlIHNwZWNpZmljcyBkZXBlbmQgb24gdGhlIHNwcml0ZSBiYXRjaCBpbXBsZW1lbnRhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZHJhd1ZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgdGV4dHVyZSB3ZSBhcmUgZHJhd2luZyBmb3IgdGhpcyBzcHJpdGVcblx0ICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IHZlcnRzIGFuIGFycmF5IG9mIHZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBvZmYgdGhlIG9mZnNldCBpbnRvIHRoZSB2ZXJ0aWNlcyBhcnJheSB0byByZWFkIGZyb21cblx0ICovXG5cdGRyYXdWZXJ0aWNlczogZnVuY3Rpb24odGV4dHVyZSwgdmVydHMsIG9mZikgIHtcblx0fSxcblxuXHRkcmF3UmVnaW9uOiBmdW5jdGlvbihyZWdpb24sIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLmRyYXcocmVnaW9uLnRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHJlZ2lvbi51LCByZWdpb24udiwgcmVnaW9uLnUyLCByZWdpb24udjIpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGUgYmF0Y2gsIGRlbGV0aW5nIGl0cyBidWZmZXJzIGFuZCByZW1vdmluZyBpdCBmcm9tIHRoZVxuXHQgKiBXZWJHTENvbnRleHQgbWFuYWdlbWVudC4gVHJ5aW5nIHRvIHVzZSB0aGlzXG5cdCAqIGJhdGNoIGFmdGVyIGRlc3Ryb3lpbmcgaXQgY2FuIGxlYWQgdG8gdW5wcmVkaWN0YWJsZSBiZWhhdmlvdXIuXG5cdCAqXG5cdCAqIElmIGBvd25zU2hhZGVyYCBpcyB0cnVlLCB0aGlzIHdpbGwgYWxzbyBkZWxldGUgdGhlIGBkZWZhdWx0U2hhZGVyYCBvYmplY3QuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudmVydGljZXMgPSBudWxsO1xuXHRcdHRoaXMuaW5kaWNlcyA9IG51bGw7XG5cdFx0dGhpcy5zaXplID0gdGhpcy5tYXhWZXJ0aWNlcyA9IDA7XG5cblx0XHRpZiAodGhpcy5vd25zU2hhZGVyICYmIHRoaXMuZGVmYXVsdFNoYWRlcilcblx0XHRcdHRoaXMuZGVmYXVsdFNoYWRlci5kZXN0cm95KCk7XG5cdFx0dGhpcy5kZWZhdWx0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLl9zaGFkZXIgPSBudWxsOyAvLyByZW1vdmUgcmVmZXJlbmNlIHRvIHdoYXRldmVyIHNoYWRlciBpcyBjdXJyZW50bHkgYmVpbmcgdXNlZFxuXG5cdFx0aWYgKHRoaXMubWVzaCkgXG5cdFx0XHR0aGlzLm1lc2guZGVzdHJveSgpO1xuXHRcdHRoaXMubWVzaCA9IG51bGw7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VCYXRjaDtcbiIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxuLy8gUmVxdWlyZXMuLi4uXG52YXIgQ2xhc3MgICAgICAgICA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG52YXIgQmFzZUJhdGNoID0gcmVxdWlyZSgnLi9CYXNlQmF0Y2gnKTtcblxudmFyIE1lc2ggICAgICAgICAgPSByZXF1aXJlKCcuL2dsdXRpbHMvTWVzaCcpO1xudmFyIFNoYWRlclByb2dyYW0gPSByZXF1aXJlKCcuL2dsdXRpbHMvU2hhZGVyUHJvZ3JhbScpO1xuXG4vKipcbiAqIEEgYmFzaWMgaW1wbGVtZW50YXRpb24gb2YgYSBiYXRjaGVyIHdoaWNoIGRyYXdzIDJEIHNwcml0ZXMuXG4gKiBUaGlzIHVzZXMgdHdvIHRyaWFuZ2xlcyAocXVhZHMpIHdpdGggaW5kZXhlZCBhbmQgaW50ZXJsZWF2ZWRcbiAqIHZlcnRleCBkYXRhLiBFYWNoIHZlcnRleCBob2xkcyA1IGZsb2F0cyAoUG9zaXRpb24ueHksIENvbG9yLCBUZXhDb29yZDAueHkpLlxuICpcbiAqIFRoZSBjb2xvciBpcyBwYWNrZWQgaW50byBhIHNpbmdsZSBmbG9hdCB0byByZWR1Y2UgdmVydGV4IGJhbmR3aWR0aCwgYW5kXG4gKiB0aGUgZGF0YSBpcyBpbnRlcmxlYXZlZCBmb3IgYmVzdCBwZXJmb3JtYW5jZS4gV2UgdXNlIGEgc3RhdGljIGluZGV4IGJ1ZmZlcixcbiAqIGFuZCBhIGR5bmFtaWMgdmVydGV4IGJ1ZmZlciB0aGF0IGlzIHVwZGF0ZWQgd2l0aCBidWZmZXJTdWJEYXRhLiBcbiAqIFxuICogQGV4YW1wbGVcbiAqICAgICAgdmFyIFNwcml0ZUJhdGNoID0gcmVxdWlyZSgna2FtaScpLlNwcml0ZUJhdGNoOyAgXG4gKiAgICAgIFxuICogICAgICAvL2NyZWF0ZSBhIG5ldyBiYXRjaGVyXG4gKiAgICAgIHZhciBiYXRjaCA9IG5ldyBTcHJpdGVCYXRjaChjb250ZXh0KTtcbiAqXG4gKiAgICAgIGZ1bmN0aW9uIHJlbmRlcigpIHtcbiAqICAgICAgICAgIGJhdGNoLmJlZ2luKCk7XG4gKiAgICAgICAgICBcbiAqICAgICAgICAgIC8vZHJhdyBzb21lIHNwcml0ZXMgaW4gYmV0d2VlbiBiZWdpbiBhbmQgZW5kLi4uXG4gKiAgICAgICAgICBiYXRjaC5kcmF3KCB0ZXh0dXJlLCAwLCAwLCAyNSwgMzIgKTtcbiAqICAgICAgICAgIGJhdGNoLmRyYXcoIHRleHR1cmUxLCAwLCAyNSwgNDIsIDIzICk7XG4gKiBcbiAqICAgICAgICAgIGJhdGNoLmVuZCgpO1xuICogICAgICB9XG4gKiBcbiAqIEBjbGFzcyAgU3ByaXRlQmF0Y2hcbiAqIEB1c2VzIEJhc2VCYXRjaFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1dlYkdMQ29udGV4dH0gY29udGV4dCB0aGUgY29udGV4dCBmb3IgdGhpcyBiYXRjaFxuICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgdGhlIG1heCBudW1iZXIgb2Ygc3ByaXRlcyB0byBmaXQgaW4gYSBzaW5nbGUgYmF0Y2hcbiAqL1xudmFyIFNwcml0ZUJhdGNoID0gbmV3IENsYXNzKHtcblxuXHQvL2luaGVyaXQgc29tZSBzdHVmZiBvbnRvIHRoaXMgcHJvdG90eXBlXG5cdE1peGluczogQmFzZUJhdGNoLFxuXG5cdC8vQ29uc3RydWN0b3Jcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gU3ByaXRlQmF0Y2goY29udGV4dCwgc2l6ZSkge1xuXHRcdEJhc2VCYXRjaC5jYWxsKHRoaXMsIGNvbnRleHQsIHNpemUpO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHByb2plY3Rpb24gRmxvYXQzMkFycmF5IHZlYzIgd2hpY2ggaXNcblx0XHQgKiB1c2VkIHRvIGF2b2lkIHNvbWUgbWF0cml4IGNhbGN1bGF0aW9ucy5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSBwcm9qZWN0aW9uXG5cdFx0ICogQHR5cGUge0Zsb2F0MzJBcnJheX1cblx0XHQgKi9cblx0XHR0aGlzLnByb2plY3Rpb24gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG5cdFx0Ly9TZXRzIHVwIGEgZGVmYXVsdCBwcm9qZWN0aW9uIHZlY3RvciBzbyB0aGF0IHRoZSBiYXRjaCB3b3JrcyB3aXRob3V0IHNldFByb2plY3Rpb25cblx0XHR0aGlzLnByb2plY3Rpb25bMF0gPSB0aGlzLmNvbnRleHQud2lkdGgvMjtcblx0XHR0aGlzLnByb2plY3Rpb25bMV0gPSB0aGlzLmNvbnRleHQuaGVpZ2h0LzI7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgY3VycmVudGx5IGJvdW5kIHRleHR1cmUuIERvIG5vdCBtb2RpZnkuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtUZXh0dXJlfSB0ZXh0dXJlXG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICovXG5cdFx0dGhpcy50ZXh0dXJlID0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHRvIHNldCB0aGUgYmF0Y2gncyBwcm9qZWN0aW9uXG5cdCAqIG1hdHJpeCB0byBhbiBvcnRob2dyYXBoaWMgMkQgcHJvamVjdGlvbiwgYmFzZWQgb24gdGhlIGdpdmVuIHNjcmVlblxuXHQgKiBzaXplLiBUaGlzIGFsbG93cyB1c2VycyB0byByZW5kZXIgaW4gMkQgd2l0aG91dCBhbnkgbmVlZCBmb3IgYSBjYW1lcmEuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IHdpZHRoICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gaGVpZ2h0IFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0cmVzaXplOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy5zZXRQcm9qZWN0aW9uKHdpZHRoLzIsIGhlaWdodC8yKTtcblx0fSxcblxuXHQvKipcblx0ICogVGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleCBmb3IgdGhpcyBiYXRjaGVyIFxuXHQgKiAoUG9zaXRpb24ueHkgKyBDb2xvciArIFRleENvb3JkMC54eSkuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFZlcnRleFNpemVcblx0ICogQHJldHVybiB7TnVtYmVyfSB0aGUgbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4XG5cdCAqL1xuXHRnZXRWZXJ0ZXhTaXplOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gU3ByaXRlQmF0Y2guVkVSVEVYX1NJWkU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVzZWQgaW50ZXJuYWxseSB0byByZXR1cm4gdGhlIFBvc2l0aW9uLCBDb2xvciwgYW5kIFRleENvb3JkMCBhdHRyaWJ1dGVzLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfY3JlYXRlVmVydGV4QXR0cmlidWV0c1xuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0X2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblxuXHRcdHJldHVybiBbIFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFNoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFLCAyKSxcblx0XHRcdCAvL3BhY2sgdGhlIGNvbG9yIHVzaW5nIHNvbWUgY3Jhenkgd2l6YXJkcnkgXG5cdFx0XHRuZXcgTWVzaC5BdHRyaWIoU2hhZGVyUHJvZ3JhbS5DT0xPUl9BVFRSSUJVVEUsIDQsIG51bGwsIGdsLlVOU0lHTkVEX0JZVEUsIHRydWUsIDEpLFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFNoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFK1wiMFwiLCAyKVxuXHRcdF07XG5cdH0sXG5cblxuXHQvKipcblx0ICogU2V0cyB0aGUgcHJvamVjdGlvbiB2ZWN0b3IsIGFuIHggYW5kIHlcblx0ICogZGVmaW5pbmcgdGhlIG1pZGRsZSBwb2ludHMgb2YgeW91ciBzdGFnZS5cblx0ICpcblx0ICogQG1ldGhvZCBzZXRQcm9qZWN0aW9uXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSB4IHRoZSB4IHByb2plY3Rpb24gdmFsdWVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IHkgdGhlIHkgcHJvamVjdGlvbiB2YWx1ZVxuXHQgKi9cblx0c2V0UHJvamVjdGlvbjogZnVuY3Rpb24oeCwgeSkge1xuXHRcdHZhciBvbGRYID0gdGhpcy5wcm9qZWN0aW9uWzBdO1xuXHRcdHZhciBvbGRZID0gdGhpcy5wcm9qZWN0aW9uWzFdO1xuXHRcdHRoaXMucHJvamVjdGlvblswXSA9IHg7XG5cdFx0dGhpcy5wcm9qZWN0aW9uWzFdID0geTtcblxuXHRcdC8vd2UgbmVlZCB0byBmbHVzaCB0aGUgYmF0Y2guLlxuXHRcdGlmICh0aGlzLmRyYXdpbmcgJiYgKHggIT0gb2xkWCB8fCB5ICE9IG9sZFkpKSB7XG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLl91cGRhdGVNYXRyaWNlcygpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIGRlZmF1bHQgc2hhZGVyIGZvciB0aGlzIGJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBfY3JlYXRlU2hhZGVyXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQHJldHVybiB7U2hhZGVyUHJvZ3JhbX0gYSBuZXcgaW5zdGFuY2Ugb2YgU2hhZGVyUHJvZ3JhbVxuXHQgKi9cblx0X2NyZWF0ZVNoYWRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHNoYWRlciA9IG5ldyBTaGFkZXJQcm9ncmFtKHRoaXMuY29udGV4dCxcblx0XHRcdFx0U3ByaXRlQmF0Y2guREVGQVVMVF9WRVJUX1NIQURFUiwgXG5cdFx0XHRcdFNwcml0ZUJhdGNoLkRFRkFVTFRfRlJBR19TSEFERVIpO1xuXHRcdGlmIChzaGFkZXIubG9nKVxuXHRcdFx0Y29uc29sZS53YXJuKFwiU2hhZGVyIExvZzpcXG5cIiArIHNoYWRlci5sb2cpO1xuXHRcdHJldHVybiBzaGFkZXI7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgY2FsbGVkIGR1cmluZyByZW5kZXJpbmcgdG8gdXBkYXRlIHByb2plY3Rpb24vdHJhbnNmb3JtXG5cdCAqIG1hdHJpY2VzIGFuZCB1cGxvYWQgdGhlIG5ldyB2YWx1ZXMgdG8gdGhlIHNoYWRlci4gRm9yIGV4YW1wbGUsXG5cdCAqIGlmIHRoZSB1c2VyIGNhbGxzIHNldFByb2plY3Rpb24gbWlkLWRyYXcsIHRoZSBiYXRjaCB3aWxsIGZsdXNoXG5cdCAqIGFuZCB0aGlzIHdpbGwgYmUgY2FsbGVkIGJlZm9yZSBjb250aW51aW5nIHRvIGFkZCBpdGVtcyB0byB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIFlvdSBnZW5lcmFsbHkgc2hvdWxkIG5vdCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS5cblx0ICogXG5cdCAqIEBtZXRob2QgIHVwZGF0ZU1hdHJpY2VzXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdHVwZGF0ZU1hdHJpY2VzOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnNoYWRlci5zZXRVbmlmb3JtZnYoXCJ1X3Byb2plY3Rpb25cIiwgdGhpcy5wcm9qZWN0aW9uKTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIGJlZm9yZSByZW5kZXJpbmcsIGFuZCBiaW5kcyB0aGUgY3VycmVudCB0ZXh0dXJlLlxuXHQgKiBcblx0ICogQG1ldGhvZCBfcHJlUmVuZGVyXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICovXG5cdF9wcmVSZW5kZXI6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLnRleHR1cmUpXG5cdFx0XHR0aGlzLnRleHR1cmUuYmluZCgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGUgc2hhZGVyLCBkaXNhYmxlcyBkZXB0aCB3cml0aW5nLCBcblx0ICogZW5hYmxlcyBibGVuZGluZywgYWN0aXZhdGVzIHRleHR1cmUgdW5pdCAwLCBhbmQgc2VuZHNcblx0ICogZGVmYXVsdCBtYXRyaWNlcyBhbmQgc2FtcGxlcjJEIHVuaWZvcm1zIHRvIHRoZSBzaGFkZXIuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGJlZ2luXG5cdCAqL1xuXHRiZWdpbjogZnVuY3Rpb24oKSB7XG5cdFx0Ly9zcHJpdGUgYmF0Y2ggZG9lc24ndCBob2xkIGEgcmVmZXJlbmNlIHRvIEdMIHNpbmNlIGl0IGlzIHZvbGF0aWxlXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFxuXHRcdC8vVGhpcyBiaW5kcyB0aGUgc2hhZGVyIGFuZCBtZXNoIVxuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuYmVnaW4uY2FsbCh0aGlzKTtcblxuXHRcdHRoaXMudXBkYXRlTWF0cmljZXMoKTsgLy9zZW5kIHByb2plY3Rpb24vdHJhbnNmb3JtIHRvIHNoYWRlclxuXG5cdFx0Ly91cGxvYWQgdGhlIHNhbXBsZXIgdW5pZm9ybS4gbm90IG5lY2Vzc2FyeSBldmVyeSBmbHVzaCBzbyB3ZSBqdXN0XG5cdFx0Ly9kbyBpdCBoZXJlLlxuXHRcdHRoaXMuc2hhZGVyLnNldFVuaWZvcm1pKFwidV90ZXh0dXJlMFwiLCAwKTtcblxuXHRcdC8vZGlzYWJsZSBkZXB0aCBtYXNrXG5cdFx0Z2wuZGVwdGhNYXNrKGZhbHNlKTtcblx0fSxcblxuXHQvKipcblx0ICogRW5kcyB0aGUgc3ByaXRlIGJhdGNoZXIgYW5kIGZsdXNoZXMgYW55IHJlbWFpbmluZyBkYXRhIHRvIHRoZSBHUFUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpIHtcblx0XHQvL3Nwcml0ZSBiYXRjaCBkb2Vzbid0IGhvbGQgYSByZWZlcmVuY2UgdG8gR0wgc2luY2UgaXQgaXMgdm9sYXRpbGVcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XG5cdFx0Ly9qdXN0IGRvIGRpcmVjdCBwYXJlbnQgY2FsbCBmb3Igc3BlZWQgaGVyZVxuXHRcdC8vVGhpcyBiaW5kcyB0aGUgc2hhZGVyIGFuZCBtZXNoIVxuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuZW5kLmNhbGwodGhpcyk7XG5cblx0XHRnbC5kZXB0aE1hc2sodHJ1ZSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEZsdXNoZXMgdGhlIGJhdGNoIHRvIHRoZSBHUFUuIFRoaXMgc2hvdWxkIGJlIGNhbGxlZCB3aGVuXG5cdCAqIHN0YXRlIGNoYW5nZXMsIHN1Y2ggYXMgYmxlbmQgZnVuY3Rpb25zLCBkZXB0aCBvciBzdGVuY2lsIHN0YXRlcyxcblx0ICogc2hhZGVycywgYW5kIHNvIGZvcnRoLlxuXHQgKiBcblx0ICogQG1ldGhvZCBmbHVzaFxuXHQgKi9cblx0Zmx1c2g6IGZ1bmN0aW9uKCkge1xuXHRcdC8vaWdub3JlIGZsdXNoIGlmIHRleHR1cmUgaXMgbnVsbCBvciBvdXIgYmF0Y2ggaXMgZW1wdHlcblx0XHRpZiAoIXRoaXMudGV4dHVyZSlcblx0XHRcdHJldHVybjtcblx0XHRpZiAodGhpcy5pZHggPT09IDApXG5cdFx0XHRyZXR1cm47XG5cdFx0QmFzZUJhdGNoLnByb3RvdHlwZS5mbHVzaC5jYWxsKHRoaXMpO1xuXHRcdFNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMrKztcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIHNwcml0ZSB0byB0aGlzIGJhdGNoLiBUaGUgc3ByaXRlIGlzIGRyYXduIGluIFxuXHQgKiBzY3JlZW4tc3BhY2Ugd2l0aCB0aGUgb3JpZ2luIGF0IHRoZSB1cHBlci1sZWZ0IGNvcm5lciAoeS1kb3duKS5cblx0ICogXG5cdCAqIEBtZXRob2QgZHJhd1xuXHQgKiBAcGFyYW0gIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSBUZXh0dXJlXG5cdCAqIEBwYXJhbSAge051bWJlcn0geCAgICAgICB0aGUgeCBwb3NpdGlvbiBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB5ICAgICAgIHRoZSB5IHBvc2l0aW9uIGluIHBpeGVscywgZGVmYXVsdHMgdG8gemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICAgdGhlIHdpZHRoIGluIHBpeGVscywgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgd2lkdGhcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgIHRoZSBoZWlnaHQgaW4gcGl4ZWxzLCBkZWZhdWx0cyB0byB0aGUgdGV4dHVyZSBoZWlnaHRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MSAgICAgIHRoZSBmaXJzdCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYxICAgICAgdGhlIGZpcnN0IFYgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTIgICAgICB0aGUgc2Vjb25kIFUgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MiAgICAgIHRoZSBzZWNvbmQgViBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKi9cblx0ZHJhdzogZnVuY3Rpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgdTEsIHYxLCB1MiwgdjIpIHtcblx0XHRpZiAoIXRoaXMuZHJhd2luZylcblx0XHRcdHRocm93IFwiSWxsZWdhbCBTdGF0ZTogdHJ5aW5nIHRvIGRyYXcgYSBiYXRjaCBiZWZvcmUgYmVnaW4oKVwiO1xuXG5cdFx0Ly9kb24ndCBkcmF3IGFueXRoaW5nIGlmIEdMIHRleCBkb2Vzbid0IGV4aXN0Li5cblx0XHRpZiAoIXRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cblx0XHRpZiAodGhpcy50ZXh0dXJlID09PSBudWxsIHx8IHRoaXMudGV4dHVyZS5pZCAhPT0gdGV4dHVyZS5pZCkge1xuXHRcdFx0Ly9uZXcgdGV4dHVyZS4uIGZsdXNoIHByZXZpb3VzIGRhdGFcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlkeCA9PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5mbHVzaCgpOyAvL3dlJ3ZlIHJlYWNoZWQgb3VyIG1heCwgZmx1c2ggYmVmb3JlIHB1c2hpbmcgbW9yZSBkYXRhXG5cdFx0fVxuXG5cdFx0d2lkdGggPSAod2lkdGg9PT0wKSA/IHdpZHRoIDogKHdpZHRoIHx8IHRleHR1cmUud2lkdGgpO1xuXHRcdGhlaWdodCA9IChoZWlnaHQ9PT0wKSA/IGhlaWdodCA6IChoZWlnaHQgfHwgdGV4dHVyZS5oZWlnaHQpO1xuXHRcdHggPSB4IHx8IDA7XG5cdFx0eSA9IHkgfHwgMDtcblxuXHRcdHZhciB4MSA9IHg7XG5cdFx0dmFyIHgyID0geCArIHdpZHRoO1xuXHRcdHZhciB5MSA9IHk7XG5cdFx0dmFyIHkyID0geSArIGhlaWdodDtcblxuXHRcdHUxID0gdTEgfHwgMDtcblx0XHR1MiA9ICh1Mj09PTApID8gdTIgOiAodTIgfHwgMSk7XG5cdFx0djEgPSB2MSB8fCAwO1xuXHRcdHYyID0gKHYyPT09MCkgPyB2MiA6ICh2MiB8fCAxKTtcblxuXHRcdHZhciBjID0gdGhpcy5jb2xvcjtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geDE7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHkxO1xuXHRcdC8vY29sb3Jcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gYztcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHUxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2MTtcblx0XHRcblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgyO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5MTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjE7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgyO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5Mjtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjI7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5Mjtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjI7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzaW5nbGUgcXVhZCBtZXNoIHRvIHRoaXMgc3ByaXRlIGJhdGNoIGZyb20gdGhlIGdpdmVuXG5cdCAqIGFycmF5IG9mIHZlcnRpY2VzLiBUaGUgc3ByaXRlIGlzIGRyYXduIGluIFxuXHQgKiBzY3JlZW4tc3BhY2Ugd2l0aCB0aGUgb3JpZ2luIGF0IHRoZSB1cHBlci1sZWZ0IGNvcm5lciAoeS1kb3duKS5cblx0ICpcblx0ICogVGhpcyByZWFkcyAyMCBpbnRlcmxlYXZlZCBmbG9hdHMgZnJvbSB0aGUgZ2l2ZW4gb2Zmc2V0IGluZGV4LCBpbiB0aGUgZm9ybWF0XG5cdCAqXG5cdCAqICB7IHgsIHksIGNvbG9yLCB1LCB2LFxuXHQgKiAgICAgIC4uLiAgfVxuXHQgKlxuXHQgKiBAbWV0aG9kICBkcmF3VmVydGljZXNcblx0ICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSBUZXh0dXJlIG9iamVjdFxuXHQgKiBAcGFyYW0ge0Zsb2F0MzJBcnJheX0gdmVydHMgYW4gYXJyYXkgb2YgdmVydGljZXNcblx0ICogQHBhcmFtIHtOdW1iZXJ9IG9mZiB0aGUgb2Zmc2V0IGludG8gdGhlIHZlcnRpY2VzIGFycmF5IHRvIHJlYWQgZnJvbVxuXHQgKi9cblx0ZHJhd1ZlcnRpY2VzOiBmdW5jdGlvbih0ZXh0dXJlLCB2ZXJ0cywgb2ZmKSB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcIklsbGVnYWwgU3RhdGU6IHRyeWluZyB0byBkcmF3IGEgYmF0Y2ggYmVmb3JlIGJlZ2luKClcIjtcblx0XHRcblx0XHQvL2Rvbid0IGRyYXcgYW55dGhpbmcgaWYgR0wgdGV4IGRvZXNuJ3QgZXhpc3QuLlxuXHRcdGlmICghdGV4dHVyZSlcblx0XHRcdHJldHVybjtcblxuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSAhPSB0ZXh0dXJlKSB7XG5cdFx0XHQvL25ldyB0ZXh0dXJlLi4gZmx1c2ggcHJldmlvdXMgZGF0YVxuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdFx0dGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaWR4ID09IHRoaXMudmVydGljZXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmZsdXNoKCk7IC8vd2UndmUgcmVhY2hlZCBvdXIgbWF4LCBmbHVzaCBiZWZvcmUgcHVzaGluZyBtb3JlIGRhdGFcblx0XHR9XG5cblx0XHRvZmYgPSBvZmYgfHwgMDtcblx0XHQvL1RPRE86IHVzZSBhIGxvb3AgaGVyZT9cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdC8vY29sb3Jcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHR9XG59KTtcblxuLyoqXG4gKiBUaGUgZGVmYXVsdCB2ZXJ0ZXggc2l6ZSwgaS5lLiBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXguXG4gKiBAYXR0cmlidXRlICBWRVJURVhfU0laRVxuICogQHN0YXRpY1xuICogQGZpbmFsXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQGRlZmF1bHQgIDVcbiAqL1xuU3ByaXRlQmF0Y2guVkVSVEVYX1NJWkUgPSA1O1xuXG4vKipcbiAqIEluY3JlbWVudGVkIGFmdGVyIGVhY2ggZHJhdyBjYWxsLCBjYW4gYmUgdXNlZCBmb3IgZGVidWdnaW5nLlxuICpcbiAqICAgICBTcHJpdGVCYXRjaC50b3RhbFJlbmRlckNhbGxzID0gMDtcbiAqXG4gKiAgICAgLi4uIGRyYXcgeW91ciBzY2VuZSAuLi5cbiAqXG4gKiAgICAgY29uc29sZS5sb2coXCJEcmF3IGNhbGxzIHBlciBmcmFtZTpcIiwgU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyk7XG4gKlxuICogXG4gKiBAYXR0cmlidXRlICB0b3RhbFJlbmRlckNhbGxzXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7TnVtYmVyfVxuICogQGRlZmF1bHQgIDBcbiAqL1xuU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyA9IDA7XG5cblNwcml0ZUJhdGNoLkRFRkFVTFRfRlJBR19TSEFERVIgPSBbXG5cdFwicHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XCIsXG5cdFwidmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XCIsXG5cdFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcblx0XCJ1bmlmb3JtIHNhbXBsZXIyRCB1X3RleHR1cmUwO1wiLFxuXG5cdFwidm9pZCBtYWluKHZvaWQpIHtcIixcblx0XCIgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlMkQodV90ZXh0dXJlMCwgdlRleENvb3JkMCkgKiB2Q29sb3I7XCIsXG5cdFwifVwiXG5dLmpvaW4oJ1xcbicpO1xuXG5TcHJpdGVCYXRjaC5ERUZBVUxUX1ZFUlRfU0hBREVSID0gW1xuXHRcImF0dHJpYnV0ZSB2ZWMyIFwiK1NoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFK1wiO1wiLFxuXHRcImF0dHJpYnV0ZSB2ZWM0IFwiK1NoYWRlclByb2dyYW0uQ09MT1JfQVRUUklCVVRFK1wiO1wiLFxuXHRcImF0dHJpYnV0ZSB2ZWMyIFwiK1NoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFK1wiMDtcIixcblxuXHRcInVuaWZvcm0gdmVjMiB1X3Byb2plY3Rpb247XCIsXG5cdFwidmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XCIsXG5cdFwidmFyeWluZyB2ZWM0IHZDb2xvcjtcIixcblxuXHRcInZvaWQgbWFpbih2b2lkKSB7XCIsIC8vL1RPRE86IHVzZSBhIHByb2plY3Rpb24gYW5kIHRyYW5zZm9ybSBtYXRyaXhcblx0XCIgICBnbF9Qb3NpdGlvbiA9IHZlYzQoIFwiXG5cdFx0K1NoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFXG5cdFx0K1wiLnggLyB1X3Byb2plY3Rpb24ueCAtIDEuMCwgXCJcblx0XHQrU2hhZGVyUHJvZ3JhbS5QT1NJVElPTl9BVFRSSUJVVEVcblx0XHQrXCIueSAvIC11X3Byb2plY3Rpb24ueSArIDEuMCAsIDAuMCwgMS4wKTtcIixcblx0XCIgICB2VGV4Q29vcmQwID0gXCIrU2hhZGVyUHJvZ3JhbS5URVhDT09SRF9BVFRSSUJVVEUrXCIwO1wiLFxuXHRcIiAgIHZDb2xvciA9IFwiK1NoYWRlclByb2dyYW0uQ09MT1JfQVRUUklCVVRFK1wiO1wiLFxuXHRcIn1cIlxuXS5qb2luKCdcXG4nKTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcHJpdGVCYXRjaDtcbiIsIi8qKlxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgU2lnbmFsID0gcmVxdWlyZSgnc2lnbmFscycpO1xudmFyIG5leHRQb3dlck9mVHdvID0gcmVxdWlyZSgnbnVtYmVyLXV0aWwnKS5uZXh0UG93ZXJPZlR3bztcbnZhciBpc1Bvd2VyT2ZUd28gPSByZXF1aXJlKCdudW1iZXItdXRpbCcpLmlzUG93ZXJPZlR3bztcblxudmFyIFRleHR1cmUgPSBuZXcgQ2xhc3Moe1xuXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgdGV4dHVyZSB3aXRoIHRoZSBvcHRpb25hbCB3aWR0aCwgaGVpZ2h0LCBhbmQgZGF0YS5cblx0ICpcblx0ICogSWYgdGhlIGNvbnN0cnVjdG9yIGlzIHBhc3NlZCBubyBwYXJhbWV0ZXJzIG90aGVyIHRoYW4gV2ViR0xDb250ZXh0LCB0aGVuXG5cdCAqIGl0IHdpbGwgbm90IGJlIGluaXRpYWxpemVkIGFuZCB3aWxsIGJlIG5vbi1yZW5kZXJhYmxlLiBZb3Ugd2lsbCBuZWVkIHRvIG1hbnVhbGx5XG5cdCAqIHVwbG9hZERhdGEgb3IgdXBsb2FkSW1hZ2UgeW91cnNlbGYuXG5cdCAqXG5cdCAqIElmIHlvdSBwYXNzIGEgd2lkdGggYW5kIGhlaWdodCBhZnRlciBjb250ZXh0LCB0aGUgdGV4dHVyZSB3aWxsIGJlIGluaXRpYWxpemVkIHdpdGggdGhhdCBzaXplXG5cdCAqIGFuZCBudWxsIGRhdGEgKGUuZy4gdHJhbnNwYXJlbnQgYmxhY2spLiBJZiB5b3UgYWxzbyBwYXNzIHRoZSBmb3JtYXQgYW5kIGRhdGEsIFxuXHQgKiBpdCB3aWxsIGJlIHVwbG9hZGVkIHRvIHRoZSB0ZXh0dXJlLiBcblx0ICpcblx0ICogSWYgeW91IHBhc3MgYSBTdHJpbmcgb3IgRGF0YSBVUkkgYXMgdGhlIHNlY29uZCBwYXJhbWV0ZXIsXG5cdCAqIHRoaXMgVGV4dHVyZSB3aWxsIGxvYWQgYW4gSW1hZ2Ugb2JqZWN0IGFzeW5jaHJvbm91c2x5LiBUaGUgb3B0aW9uYWwgdGhpcmRcblx0ICogYW5kIGZvdXJ0aCBwYXJhbWV0ZXJzIGFyZSBjYWxsYmFjayBmdW5jdGlvbnMgZm9yIHN1Y2Nlc3MgYW5kIGZhaWx1cmUsIHJlc3BlY3RpdmVseS4gXG5cdCAqIFRoZSBvcHRpb25hbCBmaWZydGggcGFyYW1ldGVyIGZvciB0aGlzIHZlcnNpb24gb2YgdGhlIGNvbnN0cnVjdG9yIGlzIGdlbk1pcG1hcHMsIHdoaWNoIGRlZmF1bHRzIHRvIGZhbHNlLiBcblx0ICogXG5cdCAqIFRoZSBhcmd1bWVudHMgYXJlIGtlcHQgaW4gbWVtb3J5IGZvciBmdXR1cmUgY29udGV4dCByZXN0b3JhdGlvbiBldmVudHMuIElmXG5cdCAqIHRoaXMgaXMgdW5kZXNpcmFibGUgKGUuZy4gaHVnZSBidWZmZXJzIHdoaWNoIG5lZWQgdG8gYmUgR0MnZCksIHlvdSBzaG91bGQgbm90XG5cdCAqIHBhc3MgdGhlIGRhdGEgaW4gdGhlIGNvbnN0cnVjdG9yLCBidXQgaW5zdGVhZCB1cGxvYWQgaXQgYWZ0ZXIgY3JlYXRpbmcgYW4gdW5pbml0aWFsaXplZCBcblx0ICogdGV4dHVyZS4gWW91IHdpbGwgbmVlZCB0byBtYW5hZ2UgaXQgeW91cnNlbGYsIGVpdGhlciBieSBleHRlbmRpbmcgdGhlIGNyZWF0ZSgpIG1ldGhvZCwgXG5cdCAqIG9yIGxpc3RlbmluZyB0byByZXN0b3JlZCBldmVudHMgaW4gV2ViR0xDb250ZXh0LlxuXHQgKlxuXHQgKiBNb3N0IHVzZXJzIHdpbGwgd2FudCB0byB1c2UgdGhlIEFzc2V0TWFuYWdlciB0byBjcmVhdGUgYW5kIG1hbmFnZSB0aGVpciB0ZXh0dXJlc1xuXHQgKiB3aXRoIGFzeW5jaHJvbm91cyBsb2FkaW5nIGFuZCBjb250ZXh0IGxvc3MuIFxuXHQgKlxuXHQgKiBAZXhhbXBsZVxuXHQgKiBcdFx0bmV3IFRleHR1cmUoY29udGV4dCwgMjU2LCAyNTYpOyAvL2VtcHR5IDI1NngyNTYgdGV4dHVyZVxuXHQgKiBcdFx0bmV3IFRleHR1cmUoY29udGV4dCwgMSwgMSwgVGV4dHVyZS5Gb3JtYXQuUkdCQSwgVGV4dHVyZS5EYXRhVHlwZS5VTlNJR05FRF9CWVRFLCBcblx0ICogXHRcdFx0XHRcdG5ldyBVaW50OEFycmF5KFsyNTUsMCwwLDI1NV0pKTsgLy8xeDEgcmVkIHRleHR1cmVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIFwidGVzdC5wbmdcIik7IC8vbG9hZHMgaW1hZ2UgYXN5bmNocm9ub3VzbHlcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIFwidGVzdC5wbmdcIiwgc3VjY2Vzc0Z1bmMsIGZhaWxGdW5jLCB1c2VNaXBtYXBzKTsgLy9leHRyYSBwYXJhbXMgZm9yIGltYWdlIGxhb2RlciBcblx0ICpcblx0ICogQGNsYXNzICBUZXh0dXJlXG5cdCAqIEBjb25zdHJ1Y3RvclxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIFdlYkdMIGNvbnRleHRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCB0aGUgd2lkdGggb2YgdGhpcyB0ZXh0dXJlXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0IHRoZSBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0IGUuZy4gVGV4dHVyZS5Gb3JtYXQuUkdCQVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGRhdGFUeXBlIGUuZy4gVGV4dHVyZS5EYXRhVHlwZS5VTlNJR05FRF9CWVRFIChVaW50OEFycmF5KVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGRhdGEgdGhlIGFycmF5IGJ1ZmZlciwgZS5nLiBhIFVpbnQ4QXJyYXkgdmlld1xuXHQgKiBAcGFyYW0gIHtCb29sZWFufSBnZW5NaXBtYXBzIHdoZXRoZXIgdG8gZ2VuZXJhdGUgbWlwbWFwcyBhZnRlciB1cGxvYWRpbmcgdGhlIGRhdGFcblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFRleHR1cmUoY29udGV4dCwgd2lkdGgsIGhlaWdodCwgZm9ybWF0LCBkYXRhVHlwZSwgZGF0YSwgZ2VuTWlwbWFwcykge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFRleHR1cmVcIjtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIFdlYkdMVGV4dHVyZSB3aGljaCBiYWNrcyB0aGlzIFRleHR1cmUgb2JqZWN0LiBUaGlzXG5cdFx0ICogY2FuIGJlIHVzZWQgZm9yIGxvdy1sZXZlbCBHTCBjYWxscy5cblx0XHQgKiBcblx0XHQgKiBAdHlwZSB7V2ViR0xUZXh0dXJlfVxuXHRcdCAqL1xuXHRcdHRoaXMuaWQgPSBudWxsOyAvL2luaXRpYWxpemVkIGluIGNyZWF0ZSgpXG5cblx0XHQvKipcblx0XHQgKiBUaGUgdGFyZ2V0IGZvciB0aGlzIHRleHR1cmUgdW5pdCwgaS5lLiBURVhUVVJFXzJELiBTdWJjbGFzc2VzXG5cdFx0ICogc2hvdWxkIG92ZXJyaWRlIHRoZSBjcmVhdGUoKSBtZXRob2QgdG8gY2hhbmdlIHRoaXMsIGZvciBjb3JyZWN0XG5cdFx0ICogdXNhZ2Ugd2l0aCBjb250ZXh0IHJlc3RvcmUuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHRhcmdldFxuXHRcdCAqIEB0eXBlIHtHTGVudW19XG5cdFx0ICogQGRlZmF1bHQgIGdsLlRFWFRVUkVfMkRcblx0XHQgKi9cblx0XHR0aGlzLnRhcmdldCA9IGNvbnRleHQuZ2wuVEVYVFVSRV8yRDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSB3aWR0aCBvZiB0aGlzIHRleHR1cmUsIGluIHBpeGVscy5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgd2lkdGhcblx0XHQgKiBAcmVhZE9ubHlcblx0XHQgKiBAdHlwZSB7TnVtYmVyfSB0aGUgd2lkdGhcblx0XHQgKi9cblx0XHR0aGlzLndpZHRoID0gMDsgLy9pbml0aWFsaXplZCBvbiB0ZXh0dXJlIHVwbG9hZFxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGhlaWdodCBvZiB0aGlzIHRleHR1cmUsIGluIHBpeGVscy5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgaGVpZ2h0XG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICogQHR5cGUge051bWJlcn0gdGhlIGhlaWdodFxuXHRcdCAqL1xuXHRcdHRoaXMuaGVpZ2h0ID0gMDsgLy9pbml0aWFsaXplZCBvbiB0ZXh0dXJlIHVwbG9hZFxuXG5cdFx0Ly8gZS5nLiAtLT4gbmV3IFRleHR1cmUoZ2wsIDI1NiwgMjU2LCBnbC5SR0IsIGdsLlVOU0lHTkVEX0JZVEUsIGRhdGEpO1xuXHRcdC8vXHRcdCAgICAgIGNyZWF0ZXMgYSBuZXcgZW1wdHkgdGV4dHVyZSwgMjU2eDI1NlxuXHRcdC8vXHRcdC0tPiBuZXcgVGV4dHVyZShnbCk7XG5cdFx0Ly9cdFx0XHQgIGNyZWF0ZXMgYSBuZXcgdGV4dHVyZSBidXQgV0lUSE9VVCB1cGxvYWRpbmcgYW55IGRhdGEuIFxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIFMgd3JhcCBwYXJhbWV0ZXIuXG5cdFx0ICogQHByb3BlcnR5IHtHTGVudW19IHdyYXBTXG5cdFx0ICovXG5cdFx0dGhpcy53cmFwUyA9IFRleHR1cmUuREVGQVVMVF9XUkFQO1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBUIHdyYXAgcGFyYW1ldGVyLlxuXHRcdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSB3cmFwVFxuXHRcdCAqL1xuXHRcdHRoaXMud3JhcFQgPSBUZXh0dXJlLkRFRkFVTFRfV1JBUDtcblx0XHQvKipcblx0XHQgKiBUaGUgbWluaWZjYXRpb24gZmlsdGVyLlxuXHRcdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSBtaW5GaWx0ZXIgXG5cdFx0ICovXG5cdFx0dGhpcy5taW5GaWx0ZXIgPSBUZXh0dXJlLkRFRkFVTFRfRklMVEVSO1xuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFRoZSBtYWduaWZpY2F0aW9uIGZpbHRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gbWFnRmlsdGVyIFxuXHRcdCAqL1xuXHRcdHRoaXMubWFnRmlsdGVyID0gVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUjtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZW4gYSB0ZXh0dXJlIGlzIGNyZWF0ZWQsIHdlIGtlZXAgdHJhY2sgb2YgdGhlIGFyZ3VtZW50cyBwcm92aWRlZCB0byBcblx0XHQgKiBpdHMgY29uc3RydWN0b3IuIE9uIGNvbnRleHQgbG9zcyBhbmQgcmVzdG9yZSwgdGhlc2UgYXJndW1lbnRzIGFyZSByZS1zdXBwbGllZFxuXHRcdCAqIHRvIHRoZSBUZXh0dXJlLCBzbyBhcyB0byByZS1jcmVhdGUgaXQgaW4gaXRzIGNvcnJlY3QgZm9ybS5cblx0XHQgKlxuXHRcdCAqIFRoaXMgaXMgbWFpbmx5IHVzZWZ1bCBpZiB5b3UgYXJlIHByb2NlZHVyYWxseSBjcmVhdGluZyB0ZXh0dXJlcyBhbmQgcGFzc2luZ1xuXHRcdCAqIHRoZWlyIGRhdGEgZGlyZWN0bHkgKGUuZy4gZm9yIGdlbmVyaWMgbG9va3VwIHRhYmxlcyBpbiBhIHNoYWRlcikuIEZvciBpbWFnZVxuXHRcdCAqIG9yIG1lZGlhIGJhc2VkIHRleHR1cmVzLCBpdCB3b3VsZCBiZSBiZXR0ZXIgdG8gdXNlIGFuIEFzc2V0TWFuYWdlciB0byBtYW5hZ2Vcblx0XHQgKiB0aGUgYXN5bmNocm9ub3VzIHRleHR1cmUgdXBsb2FkLlxuXHRcdCAqXG5cdFx0ICogVXBvbiBkZXN0cm95aW5nIGEgdGV4dHVyZSwgYSByZWZlcmVuY2UgdG8gdGhpcyBpcyBhbHNvIGxvc3QuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgbWFuYWdlZEFyZ3Ncblx0XHQgKiBAdHlwZSB7QXJyYXl9IHRoZSBhcnJheSBvZiBhcmd1bWVudHMsIHNoaWZ0ZWQgdG8gZXhjbHVkZSB0aGUgV2ViR0xDb250ZXh0IHBhcmFtZXRlclxuXHRcdCAqL1xuXHRcdHRoaXMubWFuYWdlZEFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG5cdFx0Ly9UaGlzIGlzIG1hYW5nZWQgYnkgV2ViR0xDb250ZXh0XG5cdFx0dGhpcy5jb250ZXh0LmFkZE1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBjYW4gYmUgY2FsbGVkIGFmdGVyIGNyZWF0aW5nIGEgVGV4dHVyZSB0byBsb2FkIGFuIEltYWdlIG9iamVjdCBhc3luY2hyb25vdXNseSxcblx0ICogb3IgdXBsb2FkIGltYWdlIGRhdGEgZGlyZWN0bHkuIEl0IHRha2VzIHRoZSBzYW1lIHBhcmFtZXRlcnMgYXMgdGhlIGNvbnN0cnVjdG9yLCBleGNlcHQgXG5cdCAqIGZvciB0aGUgY29udGV4dCB3aGljaCBoYXMgYWxyZWFkeSBiZWVuIGVzdGFibGlzaGVkLiBcblx0ICpcblx0ICogVXNlcnMgd2lsbCBnZW5lcmFsbHkgbm90IG5lZWQgdG8gY2FsbCB0aGlzIGRpcmVjdGx5LiBcblx0ICogXG5cdCAqIEBwcm90ZWN0ZWRcblx0ICogQG1ldGhvZCAgc2V0dXBcblx0ICovXG5cdHNldHVwOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIGRhdGFUeXBlLCBkYXRhLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdC8vSWYgdGhlIGZpcnN0IGFyZ3VtZW50IGlzIGEgc3RyaW5nLCBhc3N1bWUgaXQncyBhbiBJbWFnZSBsb2FkZXJcblx0XHQvL3NlY29uZCBhcmd1bWVudCB3aWxsIHRoZW4gYmUgZ2VuTWlwbWFwcywgdGhpcmQgYW5kIGZvdXJ0aCB0aGUgc3VjY2Vzcy9mYWlsIGNhbGxiYWNrc1xuXHRcdGlmICh0eXBlb2Ygd2lkdGggPT09IFwic3RyaW5nXCIpIHtcblx0XHRcdHZhciBpbWcgPSBuZXcgSW1hZ2UoKTtcblx0XHRcdHZhciBwYXRoICAgICAgPSBhcmd1bWVudHNbMF07ICAgLy9maXJzdCBhcmd1bWVudCwgdGhlIHBhdGhcblx0XHRcdHZhciBzdWNjZXNzQ0IgPSB0eXBlb2YgYXJndW1lbnRzWzFdID09PSBcImZ1bmN0aW9uXCIgPyBhcmd1bWVudHNbMV0gOiBudWxsO1xuXHRcdFx0dmFyIGZhaWxDQiAgICA9IHR5cGVvZiBhcmd1bWVudHNbMl0gPT09IFwiZnVuY3Rpb25cIiA/IGFyZ3VtZW50c1syXSA6IG51bGw7XG5cdFx0XHRnZW5NaXBtYXBzICAgID0gISFhcmd1bWVudHNbM107XG5cblx0XHRcdHZhciBzZWxmID0gdGhpcztcblxuXHRcdFx0Ly9JZiB5b3UgdHJ5IHRvIHJlbmRlciBhIHRleHR1cmUgdGhhdCBpcyBub3QgeWV0IFwicmVuZGVyYWJsZVwiIChpLmUuIHRoZSBcblx0XHRcdC8vYXN5bmMgbG9hZCBoYXNuJ3QgY29tcGxldGVkIHlldCwgd2hpY2ggaXMgYWx3YXlzIHRoZSBjYXNlIGluIENocm9tZSBzaW5jZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWVcblx0XHRcdC8vZmlyZXMgYmVmb3JlIGltZy5vbmxvYWQpLCBXZWJHTCB3aWxsIHRocm93IHVzIGVycm9ycy4gU28gaW5zdGVhZCB3ZSB3aWxsIGp1c3QgdXBsb2FkIHNvbWVcblx0XHRcdC8vZHVtbXkgZGF0YSB1bnRpbCB0aGUgdGV4dHVyZSBsb2FkIGlzIGNvbXBsZXRlLiBVc2VycyBjYW4gZGlzYWJsZSB0aGlzIHdpdGggdGhlIGdsb2JhbCBmbGFnLlxuXHRcdFx0aWYgKFRleHR1cmUuVVNFX0RVTU1ZXzF4MV9EQVRBKSB7XG5cdFx0XHRcdHNlbGYudXBsb2FkRGF0YSgxLCAxKTtcblx0XHRcdFx0dGhpcy53aWR0aCA9IHRoaXMuaGVpZ2h0ID0gMDtcblx0XHRcdH1cblxuXHRcdFx0aW1nLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRzZWxmLnVwbG9hZEltYWdlKGltZywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGdlbk1pcG1hcHMpO1xuXHRcdFx0XHRpZiAoc3VjY2Vzc0NCKVxuXHRcdFx0XHRcdHN1Y2Nlc3NDQigpO1xuXHRcdFx0fVxuXHRcdFx0aW1nLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gY29uc29sZS53YXJuKFwiRXJyb3IgbG9hZGluZyBpbWFnZTogXCIrcGF0aCk7XG5cdFx0XHRcdGlmIChnZW5NaXBtYXBzKSAvL3dlIHN0aWxsIG5lZWQgdG8gZ2VuIG1pcG1hcHMgb24gdGhlIDF4MSBkdW1teVxuXHRcdFx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKGdsLlRFWFRVUkVfMkQpO1xuXHRcdFx0XHRpZiAoZmFpbENCKVxuXHRcdFx0XHRcdGZhaWxDQigpO1xuXHRcdFx0fVxuXHRcdFx0aW1nLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gY29uc29sZS53YXJuKFwiSW1hZ2UgbG9hZCBhYm9ydGVkOiBcIitwYXRoKTtcblx0XHRcdFx0aWYgKGdlbk1pcG1hcHMpIC8vd2Ugc3RpbGwgbmVlZCB0byBnZW4gbWlwbWFwcyBvbiB0aGUgMXgxIGR1bW15XG5cdFx0XHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAoZ2wuVEVYVFVSRV8yRCk7XG5cdFx0XHRcdGlmIChmYWlsQ0IpXG5cdFx0XHRcdFx0ZmFpbENCKCk7XG5cdFx0XHR9XG5cblx0XHRcdGltZy5zcmMgPSBwYXRoO1xuXHRcdH0gXG5cdFx0Ly9vdGhlcndpc2UgYXNzdW1lIG91ciByZWd1bGFyIGxpc3Qgb2Ygd2lkdGgvaGVpZ2h0IGFyZ3VtZW50cyBhcmUgcGFzc2VkXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLnVwbG9hZERhdGEod2lkdGgsIGhlaWdodCwgZm9ybWF0LCBkYXRhVHlwZSwgZGF0YSwgZ2VuTWlwbWFwcyk7XG5cdFx0fVxuXHR9LFx0XG5cblx0LyoqXG5cdCAqIENhbGxlZCBpbiB0aGUgVGV4dHVyZSBjb25zdHJ1Y3RvciwgYW5kIGFmdGVyIHRoZSBHTCBjb250ZXh0IGhhcyBiZWVuIHJlLWluaXRpYWxpemVkLiBcblx0ICogU3ViY2xhc3NlcyBjYW4gb3ZlcnJpZGUgdGhpcyB0byBwcm92aWRlIGEgY3VzdG9tIGRhdGEgdXBsb2FkLCBlLmcuIGN1YmVtYXBzIG9yIGNvbXByZXNzZWRcblx0ICogdGV4dHVyZXMuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGNyZWF0ZVxuXHQgKi9cblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsOyBcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0dGhpcy5pZCA9IGdsLmNyZWF0ZVRleHR1cmUoKTsgLy90ZXh0dXJlIElEIGlzIHJlY3JlYXRlZFxuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7IC8vc2l6ZSBpcyByZXNldCB0byB6ZXJvIHVudGlsIGxvYWRlZFxuXHRcdHRoaXMudGFyZ2V0ID0gZ2wuVEVYVFVSRV8yRDsgIC8vdGhlIHByb3ZpZGVyIGNhbiBjaGFuZ2UgdGhpcyBpZiBuZWNlc3NhcnkgKGUuZy4gY3ViZSBtYXBzKVxuXG5cdFx0dGhpcy5iaW5kKCk7XG5cblxuXHRcdC8vVE9ETzogY2xlYW4gdGhlc2UgdXAgYSBsaXR0bGUuIFxuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQV9XRUJHTCwgVGV4dHVyZS5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEEpO1xuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19BTElHTk1FTlQsIFRleHR1cmUuVU5QQUNLX0FMSUdOTUVOVCk7XG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgVGV4dHVyZS5VTlBBQ0tfRkxJUF9ZKTtcblx0XHRcblx0XHR2YXIgY29sb3JzcGFjZSA9IFRleHR1cmUuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTiB8fCBnbC5CUk9XU0VSX0RFRkFVTFRfV0VCR0w7XG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTl9XRUJHTCwgY29sb3JzcGFjZSk7XG5cblx0XHQvL3NldHVwIHdyYXAgbW9kZXMgd2l0aG91dCBiaW5kaW5nIHJlZHVuZGFudGx5XG5cdFx0dGhpcy5zZXRXcmFwKHRoaXMud3JhcFMsIHRoaXMud3JhcFQsIGZhbHNlKTtcblx0XHR0aGlzLnNldEZpbHRlcih0aGlzLm1pbkZpbHRlciwgdGhpcy5tYWdGaWx0ZXIsIGZhbHNlKTtcblx0XHRcblx0XHRpZiAodGhpcy5tYW5hZ2VkQXJncy5sZW5ndGggIT09IDApIHtcblx0XHRcdHRoaXMuc2V0dXAuYXBwbHkodGhpcywgdGhpcy5tYW5hZ2VkQXJncyk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGlzIHRleHR1cmUgYnkgZGVsZXRpbmcgdGhlIEdMIHJlc291cmNlLFxuXHQgKiByZW1vdmluZyBpdCBmcm9tIHRoZSBXZWJHTENvbnRleHQgbWFuYWdlbWVudCBzdGFjayxcblx0ICogc2V0dGluZyBpdHMgc2l6ZSB0byB6ZXJvLCBhbmQgaWQgYW5kIG1hbmFnZWQgYXJndW1lbnRzIHRvIG51bGwuXG5cdCAqIFxuXHQgKiBUcnlpbmcgdG8gdXNlIHRoaXMgdGV4dHVyZSBhZnRlciBtYXkgbGVhZCB0byB1bmRlZmluZWQgYmVoYXZpb3VyLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy5pZCAmJiB0aGlzLmdsKVxuXHRcdFx0dGhpcy5nbC5kZWxldGVUZXh0dXJlKHRoaXMuaWQpO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwO1xuXHRcdHRoaXMuaWQgPSBudWxsO1xuXHRcdHRoaXMubWFuYWdlZEFyZ3MgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHdyYXAgbW9kZSBmb3IgdGhpcyB0ZXh0dXJlOyBpZiB0aGUgc2Vjb25kIGFyZ3VtZW50XG5cdCAqIGlzIHVuZGVmaW5lZCBvciBmYWxzeSwgdGhlbiBib3RoIFMgYW5kIFQgd3JhcCB3aWxsIHVzZSB0aGUgZmlyc3Rcblx0ICogYXJndW1lbnQuXG5cdCAqXG5cdCAqIFlvdSBjYW4gdXNlIFRleHR1cmUuV3JhcCBjb25zdGFudHMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCBuZWVkaW5nIFxuXHQgKiBhIEdMIHJlZmVyZW5jZS5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0V3JhcFxuXHQgKiBAcGFyYW0ge0dMZW51bX0gcyB0aGUgUyB3cmFwIG1vZGVcblx0ICogQHBhcmFtIHtHTGVudW19IHQgdGhlIFQgd3JhcCBtb2RlXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gaWdub3JlQmluZCAob3B0aW9uYWwpIGlmIHRydWUsIHRoZSBiaW5kIHdpbGwgYmUgaWdub3JlZC4gXG5cdCAqL1xuXHRzZXRXcmFwOiBmdW5jdGlvbihzLCB0LCBpZ25vcmVCaW5kKSB7IC8vVE9ETzogc3VwcG9ydCBSIHdyYXAgbW9kZVxuXHRcdGlmIChzICYmIHQpIHtcblx0XHRcdHRoaXMud3JhcFMgPSBzO1xuXHRcdFx0dGhpcy53cmFwVCA9IHQ7XG5cdFx0fSBlbHNlIFxuXHRcdFx0dGhpcy53cmFwUyA9IHRoaXMud3JhcFQgPSBzO1xuXHRcdFxuXHRcdC8vZW5mb3JjZSBQT1QgcnVsZXMuLlxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XHRcblxuXHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdHRoaXMuYmluZCgpO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfUywgdGhpcy53cmFwUyk7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1QsIHRoaXMud3JhcFQpO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIG1pbiBhbmQgbWFnIGZpbHRlciBmb3IgdGhpcyB0ZXh0dXJlOyBcblx0ICogaWYgbWFnIGlzIHVuZGVmaW5lZCBvciBmYWxzeSwgdGhlbiBib3RoIG1pbiBhbmQgbWFnIHdpbGwgdXNlIHRoZVxuXHQgKiBmaWx0ZXIgc3BlY2lmaWVkIGZvciBtaW4uXG5cdCAqXG5cdCAqIFlvdSBjYW4gdXNlIFRleHR1cmUuRmlsdGVyIGNvbnN0YW50cyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIG5lZWRpbmcgXG5cdCAqIGEgR0wgcmVmZXJlbmNlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRGaWx0ZXJcblx0ICogQHBhcmFtIHtHTGVudW19IG1pbiB0aGUgbWluaWZpY2F0aW9uIGZpbHRlclxuXHQgKiBAcGFyYW0ge0dMZW51bX0gbWFnIHRoZSBtYWduaWZpY2F0aW9uIGZpbHRlclxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IGlnbm9yZUJpbmQgaWYgdHJ1ZSwgdGhlIGJpbmQgd2lsbCBiZSBpZ25vcmVkLiBcblx0ICovXG5cdHNldEZpbHRlcjogZnVuY3Rpb24obWluLCBtYWcsIGlnbm9yZUJpbmQpIHsgXG5cdFx0aWYgKG1pbiAmJiBtYWcpIHtcblx0XHRcdHRoaXMubWluRmlsdGVyID0gbWluO1xuXHRcdFx0dGhpcy5tYWdGaWx0ZXIgPSBtYWc7XG5cdFx0fSBlbHNlIFxuXHRcdFx0dGhpcy5taW5GaWx0ZXIgPSB0aGlzLm1hZ0ZpbHRlciA9IG1pbjtcblx0XHRcblx0XHQvL2VuZm9yY2UgUE9UIHJ1bGVzLi5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1xuXG5cdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0dGhpcy5iaW5kKCk7XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfTUlOX0ZJTFRFUiwgdGhpcy5taW5GaWx0ZXIpO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgdGhpcy5tYWdGaWx0ZXIpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGxvdy1sZXZlbCBtZXRob2QgdG8gdXBsb2FkIHRoZSBzcGVjaWZpZWQgQXJyYXlCdWZmZXJWaWV3XG5cdCAqIHRvIHRoaXMgdGV4dHVyZS4gVGhpcyB3aWxsIGNhdXNlIHRoZSB3aWR0aCBhbmQgaGVpZ2h0IG9mIHRoaXNcblx0ICogdGV4dHVyZSB0byBjaGFuZ2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHVwbG9hZERhdGFcblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgICAgICAgICB0aGUgbmV3IHdpZHRoIG9mIHRoaXMgdGV4dHVyZSxcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0cyB0byB0aGUgbGFzdCB1c2VkIHdpZHRoIChvciB6ZXJvKVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCAgICAgICAgIHRoZSBuZXcgaGVpZ2h0IG9mIHRoaXMgdGV4dHVyZVxuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHRzIHRvIHRoZSBsYXN0IHVzZWQgaGVpZ2h0IChvciB6ZXJvKVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCAgICAgICAgIHRoZSBkYXRhIGZvcm1hdCwgZGVmYXVsdCBSR0JBXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gdHlwZSAgICAgICAgICAgdGhlIGRhdGEgdHlwZSwgZGVmYXVsdCBVTlNJR05FRF9CWVRFIChVaW50OEFycmF5KVxuXHQgKiBAcGFyYW0gIHtBcnJheUJ1ZmZlclZpZXd9IGRhdGEgIHRoZSByYXcgZGF0YSBmb3IgdGhpcyB0ZXh0dXJlLCBvciBudWxsIGZvciBhbiBlbXB0eSBpbWFnZVxuXHQgKiBAcGFyYW0gIHtCb29sZWFufSBnZW5NaXBtYXBzXHQgICB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhLCBkZWZhdWx0IGZhbHNlXG5cdCAqL1xuXHR1cGxvYWREYXRhOiBmdW5jdGlvbih3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIHR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Zm9ybWF0ID0gZm9ybWF0IHx8IGdsLlJHQkE7XG5cdFx0dHlwZSA9IHR5cGUgfHwgZ2wuVU5TSUdORURfQllURTtcblx0XHRkYXRhID0gZGF0YSB8fCBudWxsOyAvL21ha2Ugc3VyZSBmYWxzZXkgdmFsdWUgaXMgbnVsbCBmb3IgdGV4SW1hZ2UyRFxuXG5cdFx0dGhpcy53aWR0aCA9ICh3aWR0aCB8fCB3aWR0aD09MCkgPyB3aWR0aCA6IHRoaXMud2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSAoaGVpZ2h0IHx8IGhlaWdodD09MCkgPyBoZWlnaHQgOiB0aGlzLmhlaWdodDtcblxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdGdsLnRleEltYWdlMkQodGhpcy50YXJnZXQsIDAsIGZvcm1hdCwgXG5cdFx0XHRcdFx0ICB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCwgMCwgZm9ybWF0LFxuXHRcdFx0XHRcdCAgdHlwZSwgZGF0YSk7XG5cblx0XHRpZiAoZ2VuTWlwbWFwcylcblx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKHRoaXMudGFyZ2V0KTtcblx0fSxcblxuXHQvKipcblx0ICogVXBsb2FkcyBJbWFnZURhdGEsIEhUTUxJbWFnZUVsZW1lbnQsIEhUTUxDYW52YXNFbGVtZW50IG9yIFxuXHQgKiBIVE1MVmlkZW9FbGVtZW50LlxuXHQgKlxuXHQgKiBAbWV0aG9kICB1cGxvYWRJbWFnZVxuXHQgKiBAcGFyYW0gIHtPYmplY3R9IGRvbU9iamVjdCB0aGUgRE9NIGltYWdlIGNvbnRhaW5lclxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCB0aGUgZm9ybWF0LCBkZWZhdWx0IGdsLlJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSB0eXBlIHRoZSBkYXRhIHR5cGUsIGRlZmF1bHQgZ2wuVU5TSUdORURfQllURVxuXHQgKiBAcGFyYW0gIHtCb29sZWFufSBnZW5NaXBtYXBzIHdoZXRoZXIgdG8gZ2VuZXJhdGUgbWlwbWFwcyBhZnRlciB1cGxvYWRpbmcgdGhlIGRhdGEsIGRlZmF1bHQgZmFsc2Vcblx0ICovXG5cdHVwbG9hZEltYWdlOiBmdW5jdGlvbihkb21PYmplY3QsIGZvcm1hdCwgdHlwZSwgZ2VuTWlwbWFwcykge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHRmb3JtYXQgPSBmb3JtYXQgfHwgZ2wuUkdCQTtcblx0XHR0eXBlID0gdHlwZSB8fCBnbC5VTlNJR05FRF9CWVRFO1xuXHRcdFxuXHRcdHRoaXMud2lkdGggPSBkb21PYmplY3Qud2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBkb21PYmplY3QuaGVpZ2h0O1xuXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcblxuXHRcdHRoaXMuYmluZCgpO1xuXG5cdFx0Z2wudGV4SW1hZ2UyRCh0aGlzLnRhcmdldCwgMCwgZm9ybWF0LCBmb3JtYXQsXG5cdFx0XHRcdFx0ICB0eXBlLCBkb21PYmplY3QpO1xuXG5cdFx0aWYgKGdlbk1pcG1hcHMpXG5cdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcCh0aGlzLnRhcmdldCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIElmIEZPUkNFX1BPVCBpcyBmYWxzZSwgd2UgdmVyaWZ5IHRoaXMgdGV4dHVyZSB0byBzZWUgaWYgaXQgaXMgdmFsaWQsIFxuXHQgKiBhcyBwZXIgbm9uLXBvd2VyLW9mLXR3byBydWxlcy4gSWYgaXQgaXMgbm9uLXBvd2VyLW9mLXR3bywgaXQgbXVzdCBoYXZlIFxuXHQgKiBhIHdyYXAgbW9kZSBvZiBDTEFNUF9UT19FREdFLCBhbmQgdGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXIgbXVzdCBiZSBMSU5FQVJcblx0ICogb3IgTkVBUkVTVC4gSWYgd2UgZG9uJ3Qgc2F0aXNmeSB0aGVzZSBuZWVkcywgYW4gZXJyb3IgaXMgdGhyb3duLlxuXHQgKiBcblx0ICogQG1ldGhvZCAgX2NoZWNrUE9UXG5cdCAqIEBwcml2YXRlXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0X2NoZWNrUE9UOiBmdW5jdGlvbigpIHtcblx0XHRpZiAoIVRleHR1cmUuRk9SQ0VfUE9UKSB7XG5cdFx0XHQvL0lmIG1pbkZpbHRlciBpcyBhbnl0aGluZyBidXQgTElORUFSIG9yIE5FQVJFU1Rcblx0XHRcdC8vb3IgaWYgd3JhcFMgb3Igd3JhcFQgYXJlIG5vdCBDTEFNUF9UT19FREdFLi4uXG5cdFx0XHR2YXIgd3JvbmdGaWx0ZXIgPSAodGhpcy5taW5GaWx0ZXIgIT09IFRleHR1cmUuRmlsdGVyLkxJTkVBUiAmJiB0aGlzLm1pbkZpbHRlciAhPT0gVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVCk7XG5cdFx0XHR2YXIgd3JvbmdXcmFwID0gKHRoaXMud3JhcFMgIT09IFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFIHx8IHRoaXMud3JhcFQgIT09IFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFKTtcblxuXHRcdFx0aWYgKCB3cm9uZ0ZpbHRlciB8fCB3cm9uZ1dyYXAgKSB7XG5cdFx0XHRcdGlmICghaXNQb3dlck9mVHdvKHRoaXMud2lkdGgpIHx8ICFpc1Bvd2VyT2ZUd28odGhpcy5oZWlnaHQpKVxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcih3cm9uZ0ZpbHRlciBcblx0XHRcdFx0XHRcdFx0PyBcIk5vbi1wb3dlci1vZi10d28gdGV4dHVyZXMgY2Fubm90IHVzZSBtaXBtYXBwaW5nIGFzIGZpbHRlclwiXG5cdFx0XHRcdFx0XHRcdDogXCJOb24tcG93ZXItb2YtdHdvIHRleHR1cmVzIG11c3QgdXNlIENMQU1QX1RPX0VER0UgYXMgd3JhcFwiKTtcblx0XHRcdH1cblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEJpbmRzIHRoZSB0ZXh0dXJlLiBJZiB1bml0IGlzIHNwZWNpZmllZCxcblx0ICogaXQgd2lsbCBiaW5kIHRoZSB0ZXh0dXJlIGF0IHRoZSBnaXZlbiBzbG90XG5cdCAqIChURVhUVVJFMCwgVEVYVFVSRTEsIGV0YykuIElmIHVuaXQgaXMgbm90IHNwZWNpZmllZCxcblx0ICogaXQgd2lsbCBzaW1wbHkgYmluZCB0aGUgdGV4dHVyZSBhdCB3aGljaGV2ZXIgc2xvdFxuXHQgKiBpcyBjdXJyZW50bHkgYWN0aXZlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiaW5kXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdW5pdCB0aGUgdGV4dHVyZSB1bml0IGluZGV4LCBzdGFydGluZyBhdCAwXG5cdCAqL1xuXHRiaW5kOiBmdW5jdGlvbih1bml0KSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRpZiAodW5pdCB8fCB1bml0ID09PSAwKVxuXHRcdFx0Z2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCArIHVuaXQpO1xuXHRcdGdsLmJpbmRUZXh0dXJlKHRoaXMudGFyZ2V0LCB0aGlzLmlkKTtcblx0fSxcblxuXHR0b1N0cmluZzogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuaWQgKyBcIjpcIiArIHRoaXMud2lkdGggKyBcInhcIiArIHRoaXMuaGVpZ2h0ICsgXCJcIjtcblx0fVxufSk7XG5cbi8qKiBcbiAqIEEgc2V0IG9mIEZpbHRlciBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuRmlsdGVyLk5FQVJFU1RcbiAqICAgICBUZXh0dXJlLkZpbHRlci5ORUFSRVNUX01JUE1BUF9MSU5FQVJcbiAqICAgICBUZXh0dXJlLkZpbHRlci5ORUFSRVNUX01JUE1BUF9ORUFSRVNUXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTElORUFSXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTElORUFSX01JUE1BUF9MSU5FQVJcbiAqICAgICBUZXh0dXJlLkZpbHRlci5MSU5FQVJfTUlQTUFQX05FQVJFU1RcbiAqIGBgYFxuICogQGF0dHJpYnV0ZSBGaWx0ZXJcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuRmlsdGVyID0ge1xuXHRORUFSRVNUOiA5NzI4LFxuXHRORUFSRVNUX01JUE1BUF9MSU5FQVI6IDk5ODYsXG5cdE5FQVJFU1RfTUlQTUFQX05FQVJFU1Q6IDk5ODQsXG5cdExJTkVBUjogOTcyOSxcblx0TElORUFSX01JUE1BUF9MSU5FQVI6IDk5ODcsXG5cdExJTkVBUl9NSVBNQVBfTkVBUkVTVDogOTk4NVxufTtcblxuLyoqIFxuICogQSBzZXQgb2YgV3JhcCBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFXG4gKiAgICAgVGV4dHVyZS5XcmFwLk1JUlJPUkVEX1JFUEVBVFxuICogICAgIFRleHR1cmUuV3JhcC5SRVBFQVRcbiAqIGBgYFxuICogQGF0dHJpYnV0ZSBXcmFwXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLldyYXAgPSB7XG5cdENMQU1QX1RPX0VER0U6IDMzMDcxLFxuXHRNSVJST1JFRF9SRVBFQVQ6IDMzNjQ4LFxuXHRSRVBFQVQ6IDEwNDk3XG59O1xuXG4vKiogXG4gKiBBIHNldCBvZiBGb3JtYXQgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLkZvcm1hdC5SR0JcbiAqICAgICBUZXh0dXJlLkZvcm1hdC5SR0JBXG4gKiAgICAgVGV4dHVyZS5Gb3JtYXQuTFVNSU5BTkNFX0FMUEhBXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgRm9ybWF0XG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLkZvcm1hdCA9IHtcblx0REVQVEhfQ09NUE9ORU5UOiA2NDAyLFxuXHRBTFBIQTogNjQwNixcblx0UkdCQTogNjQwOCxcblx0UkdCOiA2NDA3LFxuXHRMVU1JTkFOQ0U6IDY0MDksXG5cdExVTUlOQU5DRV9BTFBIQTogNjQxMFxufTtcblxuLyoqIFxuICogQSBzZXQgb2YgRGF0YVR5cGUgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLkRhdGFUeXBlLlVOU0lHTkVEX0JZVEUgXG4gKiAgICAgVGV4dHVyZS5EYXRhVHlwZS5GTE9BVCBcbiAqIGBgYFxuICogQGF0dHJpYnV0ZSBEYXRhVHlwZVxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5EYXRhVHlwZSA9IHtcblx0QllURTogNTEyMCxcblx0U0hPUlQ6IDUxMjIsXG5cdElOVDogNTEyNCxcblx0RkxPQVQ6IDUxMjYsXG5cdFVOU0lHTkVEX0JZVEU6IDUxMjEsXG5cdFVOU0lHTkVEX0lOVDogNTEyNSxcblx0VU5TSUdORURfU0hPUlQ6IDUxMjMsXG5cdFVOU0lHTkVEX1NIT1JUXzRfNF80XzQ6IDMyODE5LFxuXHRVTlNJR05FRF9TSE9SVF81XzVfNV8xOiAzMjgyMCxcblx0VU5TSUdORURfU0hPUlRfNV82XzU6IDMzNjM1XG59XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgd3JhcCBtb2RlIHdoZW4gY3JlYXRpbmcgbmV3IHRleHR1cmVzLiBJZiBhIGN1c3RvbSBcbiAqIHByb3ZpZGVyIHdhcyBzcGVjaWZpZWQsIGl0IG1heSBjaG9vc2UgdG8gb3ZlcnJpZGUgdGhpcyBkZWZhdWx0IG1vZGUuXG4gKiBcbiAqIEBhdHRyaWJ1dGUge0dMZW51bX0gREVGQVVMVF9XUkFQXG4gKiBAc3RhdGljIFxuICogQGRlZmF1bHQgIFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFXG4gKi9cblRleHR1cmUuREVGQVVMVF9XUkFQID0gVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0U7XG5cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCBmaWx0ZXIgbW9kZSB3aGVuIGNyZWF0aW5nIG5ldyB0ZXh0dXJlcy4gSWYgYSBjdXN0b21cbiAqIHByb3ZpZGVyIHdhcyBzcGVjaWZpZWQsIGl0IG1heSBjaG9vc2UgdG8gb3ZlcnJpZGUgdGhpcyBkZWZhdWx0IG1vZGUuXG4gKlxuICogQGF0dHJpYnV0ZSB7R0xlbnVtfSBERUZBVUxUX0ZJTFRFUlxuICogQHN0YXRpY1xuICogQGRlZmF1bHQgIFRleHR1cmUuRmlsdGVyLkxJTkVBUlxuICovXG5UZXh0dXJlLkRFRkFVTFRfRklMVEVSID0gVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVDtcblxuLyoqXG4gKiBCeSBkZWZhdWx0LCB3ZSBkbyBzb21lIGVycm9yIGNoZWNraW5nIHdoZW4gY3JlYXRpbmcgdGV4dHVyZXNcbiAqIHRvIGVuc3VyZSB0aGF0IHRoZXkgd2lsbCBiZSBcInJlbmRlcmFibGVcIiBieSBXZWJHTC4gTm9uLXBvd2VyLW9mLXR3b1xuICogdGV4dHVyZXMgbXVzdCB1c2UgQ0xBTVBfVE9fRURHRSBhcyB0aGVpciB3cmFwIG1vZGUsIGFuZCBORUFSRVNUIG9yIExJTkVBUlxuICogYXMgdGhlaXIgd3JhcCBtb2RlLiBGdXJ0aGVyLCB0cnlpbmcgdG8gZ2VuZXJhdGUgbWlwbWFwcyBmb3IgYSBOUE9UIGltYWdlXG4gKiB3aWxsIGxlYWQgdG8gZXJyb3JzLiBcbiAqXG4gKiBIb3dldmVyLCB5b3UgY2FuIGRpc2FibGUgdGhpcyBlcnJvciBjaGVja2luZyBieSBzZXR0aW5nIGBGT1JDRV9QT1RgIHRvIHRydWUuXG4gKiBUaGlzIG1heSBiZSB1c2VmdWwgaWYgeW91IGFyZSBydW5uaW5nIG9uIHNwZWNpZmljIGhhcmR3YXJlIHRoYXQgc3VwcG9ydHMgUE9UIFxuICogdGV4dHVyZXMsIG9yIGluIHNvbWUgZnV0dXJlIGNhc2Ugd2hlcmUgTlBPVCB0ZXh0dXJlcyBpcyBhZGRlZCBhcyBhIFdlYkdMIGV4dGVuc2lvbi5cbiAqIFxuICogQGF0dHJpYnV0ZSB7Qm9vbGVhbn0gRk9SQ0VfUE9UXG4gKiBAc3RhdGljXG4gKiBAZGVmYXVsdCAgZmFsc2VcbiAqL1xuVGV4dHVyZS5GT1JDRV9QT1QgPSBmYWxzZTtcblxuLy9kZWZhdWx0IHBpeGVsIHN0b3JlIG9wZXJhdGlvbnMuIFVzZWQgaW4gY3JlYXRlKClcblRleHR1cmUuVU5QQUNLX0ZMSVBfWSA9IGZhbHNlO1xuVGV4dHVyZS5VTlBBQ0tfQUxJR05NRU5UID0gMTtcblRleHR1cmUuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBID0gdHJ1ZTsgXG5UZXh0dXJlLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT04gPSB1bmRlZmluZWQ7XG5cbi8vZm9yIHRoZSBJbWFnZSBjb25zdHJ1Y3RvciB3ZSBuZWVkIHRvIGhhbmRsZSB0aGluZ3MgYSBiaXQgZGlmZmVyZW50bHkuLlxuVGV4dHVyZS5VU0VfRFVNTVlfMXgxX0RBVEEgPSB0cnVlO1xuXG4vKipcbiAqIFV0aWxpdHkgdG8gZ2V0IHRoZSBudW1iZXIgb2YgY29tcG9uZW50cyBmb3IgdGhlIGdpdmVuIEdMZW51bSwgZS5nLiBnbC5SR0JBIHJldHVybnMgNC5cbiAqIFJldHVybnMgbnVsbCBpZiB0aGUgc3BlY2lmaWVkIGZvcm1hdCBpcyBub3Qgb2YgdHlwZSBERVBUSF9DT01QT05FTlQsIEFMUEhBLCBMVU1JTkFOQ0UsXG4gKiBMVU1JTkFOQ0VfQUxQSEEsIFJHQiwgb3IgUkdCQS5cbiAqIFxuICogQG1ldGhvZCBnZXROdW1Db21wb25lbnRzXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCBhIHRleHR1cmUgZm9ybWF0LCBpLmUuIFRleHR1cmUuRm9ybWF0LlJHQkFcbiAqIEByZXR1cm4ge051bWJlcn0gdGhlIG51bWJlciBvZiBjb21wb25lbnRzIGZvciB0aGlzIGZvcm1hdFxuICovXG5UZXh0dXJlLmdldE51bUNvbXBvbmVudHMgPSBmdW5jdGlvbihmb3JtYXQpIHtcblx0c3dpdGNoIChmb3JtYXQpIHtcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkRFUFRIX0NPTVBPTkVOVDpcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkFMUEhBOlxuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuTFVNSU5BTkNFOlxuXHRcdFx0cmV0dXJuIDE7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5MVU1JTkFOQ0VfQUxQSEE6XG5cdFx0XHRyZXR1cm4gMjtcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LlJHQjpcblx0XHRcdHJldHVybiAzO1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuUkdCQTpcblx0XHRcdHJldHVybiA0O1xuXHR9XG5cdHJldHVybiBudWxsO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0dXJlOyIsInZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG4vL1RoaXMgaXMgYSBHTC1zcGVjaWZpYyB0ZXh0dXJlIHJlZ2lvbiwgZW1wbG95aW5nIHRhbmdlbnQgc3BhY2Ugbm9ybWFsaXplZCBjb29yZGluYXRlcyBVIGFuZCBWLlxuLy9BIGNhbnZhcy1zcGVjaWZpYyByZWdpb24gd291bGQgcmVhbGx5IGp1c3QgYmUgYSBsaWdodHdlaWdodCBvYmplY3Qgd2l0aCB7IHgsIHksIHdpZHRoLCBoZWlnaHQgfVxuLy9pbiBwaXhlbHMuXG52YXIgVGV4dHVyZVJlZ2lvbiA9IG5ldyBDbGFzcyh7XG5cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gVGV4dHVyZVJlZ2lvbih0ZXh0dXJlLCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy50ZXh0dXJlID0gdGV4dHVyZTtcblx0XHR0aGlzLnNldFJlZ2lvbih4LCB5LCB3aWR0aCwgaGVpZ2h0KTtcblx0fSxcblxuXHRzZXRVVnM6IGZ1bmN0aW9uKHUsIHYsIHUyLCB2Mikge1xuXHRcdHRoaXMucmVnaW9uV2lkdGggPSBNYXRoLnJvdW5kKE1hdGguYWJzKHUyIC0gdSkgKiB0aGlzLnRleHR1cmUud2lkdGgpO1xuICAgICAgICB0aGlzLnJlZ2lvbkhlaWdodCA9IE1hdGgucm91bmQoTWF0aC5hYnModjIgLSB2KSAqIHRoaXMudGV4dHVyZS5oZWlnaHQpO1xuXG4gICAgICAgIC8vIEZyb20gTGliR0RYIFRleHR1cmVSZWdpb24uamF2YSAtLSBcblx0XHQvLyBGb3IgYSAxeDEgcmVnaW9uLCBhZGp1c3QgVVZzIHRvd2FyZCBwaXhlbCBjZW50ZXIgdG8gYXZvaWQgZmlsdGVyaW5nIGFydGlmYWN0cyBvbiBBTUQgR1BVcyB3aGVuIGRyYXdpbmcgdmVyeSBzdHJldGNoZWQuXG5cdFx0aWYgKHRoaXMucmVnaW9uV2lkdGggPT0gMSAmJiB0aGlzLnJlZ2lvbkhlaWdodCA9PSAxKSB7XG5cdFx0XHR2YXIgYWRqdXN0WCA9IDAuMjUgLyB0aGlzLnRleHR1cmUud2lkdGg7XG5cdFx0XHR1ICs9IGFkanVzdFg7XG5cdFx0XHR1MiAtPSBhZGp1c3RYO1xuXHRcdFx0dmFyIGFkanVzdFkgPSAwLjI1IC8gdGhpcy50ZXh0dXJlLmhlaWdodDtcblx0XHRcdHYgKz0gYWRqdXN0WTtcblx0XHRcdHYyIC09IGFkanVzdFk7XG5cdFx0fVxuXG5cdFx0dGhpcy51ID0gdTtcblx0XHR0aGlzLnYgPSB2O1xuXHRcdHRoaXMudTIgPSB1Mjtcblx0XHR0aGlzLnYyID0gdjI7XG5cdH0sXG5cblx0c2V0UmVnaW9uOiBmdW5jdGlvbih4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0eCA9IHggfHwgMDtcblx0XHR5ID0geSB8fCAwO1xuXHRcdHdpZHRoID0gKHdpZHRoPT09MCB8fCB3aWR0aCkgPyB3aWR0aCA6IHRoaXMudGV4dHVyZS53aWR0aDtcblx0XHRoZWlnaHQgPSAoaGVpZ2h0PT09MCB8fCBoZWlnaHQpID8gaGVpZ2h0IDogdGhpcy50ZXh0dXJlLmhlaWdodDtcblxuXHRcdHZhciBpbnZUZXhXaWR0aCA9IDEgLyB0aGlzLnRleHR1cmUud2lkdGg7XG5cdFx0dmFyIGludlRleEhlaWdodCA9IDEgLyB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdHRoaXMuc2V0VVZzKHggKiBpbnZUZXhXaWR0aCwgeSAqIGludlRleEhlaWdodCwgKHggKyB3aWR0aCkgKiBpbnZUZXhXaWR0aCwgKHkgKyBoZWlnaHQpICogaW52VGV4SGVpZ2h0KTtcblx0XHR0aGlzLnJlZ2lvbldpZHRoID0gTWF0aC5hYnMod2lkdGgpO1xuXHRcdHRoaXMucmVnaW9uSGVpZ2h0ID0gTWF0aC5hYnMoaGVpZ2h0KTtcblx0fSxcblxuXHQvKiogU2V0cyB0aGUgdGV4dHVyZSB0byB0aGF0IG9mIHRoZSBzcGVjaWZpZWQgcmVnaW9uIGFuZCBzZXRzIHRoZSBjb29yZGluYXRlcyByZWxhdGl2ZSB0byB0aGUgc3BlY2lmaWVkIHJlZ2lvbi4gKi9cblx0c2V0RnJvbVJlZ2lvbjogZnVuY3Rpb24ocmVnaW9uLCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy50ZXh0dXJlID0gcmVnaW9uLnRleHR1cmU7XG5cdFx0dGhpcy5zZXQocmVnaW9uLmdldFJlZ2lvblgoKSArIHgsIHJlZ2lvbi5nZXRSZWdpb25ZKCkgKyB5LCB3aWR0aCwgaGVpZ2h0KTtcblx0fSxcblxuXG5cdC8vVE9ETzogYWRkIHNldHRlcnMgZm9yIHJlZ2lvblgvWSBhbmQgcmVnaW9uV2lkdGgvSGVpZ2h0XG5cblx0cmVnaW9uWDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCh0aGlzLnUgKiB0aGlzLnRleHR1cmUud2lkdGgpO1xuXHRcdH0gXG5cdH0sXG5cblx0cmVnaW9uWToge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gTWF0aC5yb3VuZCh0aGlzLnYgKiB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblx0XHR9XG5cdH0sXG5cblx0ZmxpcDogZnVuY3Rpb24oeCwgeSkge1xuXHRcdHZhciB0ZW1wO1xuXHRcdGlmICh4KSB7XG5cdFx0XHR0ZW1wID0gdGhpcy51O1xuXHRcdFx0dGhpcy51ID0gdGhpcy51Mjtcblx0XHRcdHRoaXMudTIgPSB0ZW1wO1xuXHRcdH1cblx0XHRpZiAoeSkge1xuXHRcdFx0dGVtcCA9IHRoaXMudjtcblx0XHRcdHRoaXMudiA9IHRoaXMudjI7XG5cdFx0XHR0aGlzLnYyID0gdGVtcDtcblx0XHR9XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRleHR1cmVSZWdpb247IiwiLyoqXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBTaWduYWwgPSByZXF1aXJlKCdzaWduYWxzJyk7XG5cbi8qKlxuICogQSB0aGluIHdyYXBwZXIgYXJvdW5kIFdlYkdMUmVuZGVyaW5nQ29udGV4dCB3aGljaCBoYW5kbGVzXG4gKiBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUgd2l0aCB2YXJpb3VzIHJlbmRlcmluZyBvYmplY3RzICh0ZXh0dXJlcyxcbiAqIHNoYWRlcnMgYW5kIGJ1ZmZlcnMpLiBUaGlzIGFsc28gaGFuZGxlcyBnZW5lcmFsIHZpZXdwb3J0IG1hbmFnZW1lbnQuXG4gKlxuICogSWYgdGhlIHZpZXcgaXMgbm90IHNwZWNpZmllZCwgYSBjYW52YXMgd2lsbCBiZSBjcmVhdGVkLlxuICpcbiAqIElmIHRoZSBgdmlld2AgcGFyYW1ldGVyIGlzIGFuIGluc3RhbmNlb2YgV2ViR0xSZW5kZXJpbmdDb250ZXh0LFxuICogd2Ugd2lsbCB1c2UgaXRzIGNhbnZhcyBhbmQgY29udGV4dCB3aXRob3V0IGZldGNoaW5nIGFub3RoZXIgdGhyb3VnaCBgZ2V0Q29udGV4dGAuXG4gKiBQYXNzaW5nIGEgY2FudmFzIHRoYXQgaGFzIGFscmVhZHkgaGFkIGBnZXRDb250ZXh0KCd3ZWJnbCcpYCBjYWxsZWQgd2lsbCBub3QgY2F1c2VcbiAqIGVycm9ycywgYnV0IGluIGNlcnRhaW4gZGVidWdnZXJzIChlLmcuIENocm9tZSBXZWJHTCBJbnNwZWN0b3IpIG9ubHkgdGhlIGxhdGVzdFxuICogY29udGV4dCB3aWxsIGJlIHRyYWNlZC5cbiAqIFxuICogQGNsYXNzICBXZWJHTENvbnRleHRcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtOdW1iZXJ9IHdpZHRoIHRoZSB3aWR0aCBvZiB0aGUgR0wgY2FudmFzXG4gKiBAcGFyYW0ge051bWJlcn0gaGVpZ2h0IHRoZSBoZWlnaHQgb2YgdGhlIEdMIGNhbnZhc1xuICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gdmlldyB0aGUgb3B0aW9uYWwgRE9NIGNhbnZhcyBlbGVtZW50XG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dEF0dHJpYnVldHMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgY29udGV4dCBhdHRyaWJzIHdoaWNoXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lsbCBiZSB1c2VkIGR1cmluZyBHTCBpbml0aWFsaXphdGlvblxuICovXG52YXIgV2ViR0xDb250ZXh0ID0gbmV3IENsYXNzKHtcblx0XG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFdlYkdMQ29udGV4dCh3aWR0aCwgaGVpZ2h0LCB2aWV3LCBjb250ZXh0QXR0cmlidXRlcykge1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBsaXN0IG9mIHJlbmRlcmluZyBvYmplY3RzIChzaGFkZXJzLCBWQk9zLCB0ZXh0dXJlcywgZXRjKSB3aGljaCBhcmUgXG5cdFx0ICogY3VycmVudGx5IGJlaW5nIG1hbmFnZWQuIEFueSBvYmplY3Qgd2l0aCBhIFwiY3JlYXRlXCIgbWV0aG9kIGNhbiBiZSBhZGRlZFxuXHRcdCAqIHRvIHRoaXMgbGlzdC4gVXBvbiBkZXN0cm95aW5nIHRoZSByZW5kZXJpbmcgb2JqZWN0LCBpdCBzaG91bGQgYmUgcmVtb3ZlZC5cblx0XHQgKiBTZWUgYWRkTWFuYWdlZE9iamVjdCBhbmQgcmVtb3ZlTWFuYWdlZE9iamVjdC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0FycmF5fSBtYW5hZ2VkT2JqZWN0c1xuXHRcdCAqL1xuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMgPSBbXTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBhY3R1YWwgR0wgY29udGV4dC4gWW91IGNhbiB1c2UgdGhpcyBmb3Jcblx0XHQgKiByYXcgR0wgY2FsbHMgb3IgdG8gYWNjZXNzIEdMZW51bSBjb25zdGFudHMuIFRoaXNcblx0XHQgKiB3aWxsIGJlIHVwZGF0ZWQgb24gY29udGV4dCByZXN0b3JlLiBXaGlsZSB0aGUgV2ViR0xDb250ZXh0XG5cdFx0ICogaXMgbm90IGB2YWxpZGAsIHlvdSBzaG91bGQgbm90IHRyeSB0byBhY2Nlc3MgR0wgc3RhdGUuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGdsXG5cdFx0ICogQHR5cGUge1dlYkdMUmVuZGVyaW5nQ29udGV4dH1cblx0XHQgKi9cblx0XHR0aGlzLmdsID0gbnVsbDtcblxuXHRcdGlmICh2aWV3ICYmIHR5cGVvZiB3aW5kb3cuV2ViR0xSZW5kZXJpbmdDb250ZXh0ICE9PSBcInVuZGVmaW5lZFwiXG5cdFx0XHRcdCAmJiB2aWV3IGluc3RhbmNlb2Ygd2luZG93LldlYkdMUmVuZGVyaW5nQ29udGV4dCkge1xuXHRcdFx0dmlldyA9IHZpZXcuY2FudmFzO1xuXHRcdFx0dGhpcy5nbCA9IHZpZXc7XG5cdFx0XHR0aGlzLnZhbGlkID0gdHJ1ZTtcblx0XHRcdGNvbnRleHRBdHRyaWJ1dGVzID0gdW5kZWZpbmVkOyAvL2p1c3QgaWdub3JlIG5ldyBhdHRyaWJzLi4uXG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGNhbnZhcyBET00gZWxlbWVudCBmb3IgdGhpcyBjb250ZXh0LlxuXHRcdCAqIEBwcm9wZXJ0eSB7TnVtYmVyfSB2aWV3XG5cdFx0ICovXG5cdFx0dGhpcy52aWV3ID0gdmlldyB8fCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpO1xuXG5cdFx0Ly9kZWZhdWx0IHNpemUgYXMgcGVyIHNwZWM6XG5cdFx0Ly9odHRwOi8vd3d3LnczLm9yZy9UUi8yMDEyL1dELWh0bWw1LWF1dGhvci0yMDEyMDMyOS90aGUtY2FudmFzLWVsZW1lbnQuaHRtbCN0aGUtY2FudmFzLWVsZW1lbnRcblx0XHRcblx0XHQvKipcblx0XHQgKiBUaGUgd2lkdGggb2YgdGhpcyBjYW52YXMuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgd2lkdGhcblx0XHQgKiBAdHlwZSB7TnVtYmVyfVxuXHRcdCAqL1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLnZpZXcud2lkdGggPSB3aWR0aCB8fCAzMDA7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgaGVpZ2h0IG9mIHRoaXMgY2FudmFzLlxuXHRcdCAqIEBwcm9wZXJ0eSBoZWlnaHRcblx0XHQgKiBAdHlwZSB7TnVtYmVyfVxuXHRcdCAqL1xuXHRcdHRoaXMuaGVpZ2h0ID0gdGhpcy52aWV3LmhlaWdodCA9IGhlaWdodCB8fCAxNTA7XG5cblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBjb250ZXh0IGF0dHJpYnV0ZXMgZm9yIGluaXRpYWxpemluZyB0aGUgR0wgc3RhdGUuIFRoaXMgbWlnaHQgaW5jbHVkZVxuXHRcdCAqIGFudGktYWxpYXNpbmcsIGFscGhhIHNldHRpbmdzLCB2ZXJpc29uLCBhbmQgc28gZm9ydGguXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtPYmplY3R9IGNvbnRleHRBdHRyaWJ1dGVzIFxuXHRcdCAqL1xuXHRcdHRoaXMuY29udGV4dEF0dHJpYnV0ZXMgPSBjb250ZXh0QXR0cmlidXRlcztcblx0XHRcblx0XHQvKipcblx0XHQgKiBXaGV0aGVyIHRoaXMgY29udGV4dCBpcyAndmFsaWQnLCBpLmUuIHJlbmRlcmFibGUuIEEgY29udGV4dCB0aGF0IGhhcyBiZWVuIGxvc3Rcblx0XHQgKiAoYW5kIG5vdCB5ZXQgcmVzdG9yZWQpIG9yIGRlc3Ryb3llZCBpcyBpbnZhbGlkLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gdmFsaWRcblx0XHQgKi9cblx0XHR0aGlzLnZhbGlkID0gZmFsc2U7XG5cblx0XHQvKipcblx0XHQgKiBBIHNpZ25hbCBkaXNwYXRjaGVkIHdoZW4gR0wgY29udGV4dCBpcyBsb3N0LiBcblx0XHQgKiBcblx0XHQgKiBUaGUgZmlyc3QgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBsaXN0ZW5lciBpcyB0aGUgV2ViR0xDb250ZXh0XG5cdFx0ICogbWFuYWdpbmcgdGhlIGNvbnRleHQgbG9zcy5cblx0XHQgKiBcblx0XHQgKiBAZXZlbnQge1NpZ25hbH0gbG9zdFxuXHRcdCAqL1xuXHRcdHRoaXMubG9zdCA9IG5ldyBTaWduYWwoKTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgc2lnbmFsIGRpc3BhdGNoZWQgd2hlbiBHTCBjb250ZXh0IGlzIHJlc3RvcmVkLCBhZnRlciBhbGwgdGhlIG1hbmFnZWRcblx0XHQgKiBvYmplY3RzIGhhdmUgYmVlbiByZWNyZWF0ZWQuXG5cdFx0ICpcblx0XHQgKiBUaGUgZmlyc3QgYXJndW1lbnQgcGFzc2VkIHRvIHRoZSBsaXN0ZW5lciBpcyB0aGUgV2ViR0xDb250ZXh0XG5cdFx0ICogd2hpY2ggbWFuYWdlZCB0aGUgcmVzdG9yYXRpb24uXG5cdFx0ICpcblx0XHQgKiBUaGlzIGRvZXMgbm90IGdhdXJlbnRlZSB0aGF0IGFsbCBvYmplY3RzIHdpbGwgYmUgcmVuZGVyYWJsZS5cblx0XHQgKiBGb3IgZXhhbXBsZSwgYSBUZXh0dXJlIHdpdGggYW4gSW1hZ2VQcm92aWRlciBtYXkgc3RpbGwgYmUgbG9hZGluZ1xuXHRcdCAqIGFzeW5jaHJvbm91c2x5Llx0IFxuXHRcdCAqIFxuXHRcdCAqIEBldmVudCB7U2lnbmFsfSByZXN0b3JlZFxuXHRcdCAqL1xuXHRcdHRoaXMucmVzdG9yZWQgPSBuZXcgU2lnbmFsKCk7XHRcblx0XHRcblx0XHQvL3NldHVwIGNvbnRleHQgbG9zdCBhbmQgcmVzdG9yZSBsaXN0ZW5lcnNcblx0XHR0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dGxvc3RcIiwgZnVuY3Rpb24gKGV2KSB7XG5cdFx0XHRldi5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0dGhpcy5fY29udGV4dExvc3QoZXYpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0dGhpcy52aWV3LmFkZEV2ZW50TGlzdGVuZXIoXCJ3ZWJnbGNvbnRleHRyZXN0b3JlZFwiLCBmdW5jdGlvbiAoZXYpIHtcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0UmVzdG9yZWQoZXYpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG5cdFx0XHRcblx0XHRpZiAoIXRoaXMudmFsaWQpIC8vd291bGQgb25seSBiZSB2YWxpZCBpZiBXZWJHTFJlbmRlcmluZ0NvbnRleHQgd2FzIHBhc3NlZCBcblx0XHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHR0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cdFxuXHRfaW5pdENvbnRleHQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBlcnIgPSBcIlwiO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmdsID0gKHRoaXMudmlldy5nZXRDb250ZXh0KCd3ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpIFxuXHRcdFx0XHRcdFx0fHwgdGhpcy52aWV3LmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nbCkge1xuXHRcdFx0dGhpcy52YWxpZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IFwiV2ViR0wgQ29udGV4dCBOb3QgU3VwcG9ydGVkIC0tIHRyeSBlbmFibGluZyBpdCBvciB1c2luZyBhIGRpZmZlcmVudCBicm93c2VyXCI7XG5cdFx0fVx0XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhpcyBXZWJHTCBjb250ZXh0LCByZXNpemVzXG5cdCAqIHRoZSBjYW52YXMgdmlldywgYW5kIGNhbGxzIGdsLnZpZXdwb3J0KCkgd2l0aCB0aGUgbmV3IHNpemUuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICB0aGUgbmV3IHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0IHRoZSBuZXcgaGVpZ2h0XG5cdCAqL1xuXHRyZXNpemU6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHR0aGlzLnZpZXcud2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0O1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIChpbnRlcm5hbCB1c2UpXG5cdCAqIEEgbWFuYWdlZCBvYmplY3QgaXMgYW55dGhpbmcgd2l0aCBhIFwiY3JlYXRlXCIgZnVuY3Rpb24sIHRoYXQgd2lsbFxuXHQgKiByZXN0b3JlIEdMIHN0YXRlIGFmdGVyIGNvbnRleHQgbG9zcy4gXG5cdCAqIFxuXHQgKiBAcGFyYW0ge1t0eXBlXX0gdGV4IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGFkZE1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMucHVzaChvYmopO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiAoaW50ZXJuYWwgdXNlKVxuXHQgKiBSZW1vdmVzIGEgbWFuYWdlZCBvYmplY3QgZnJvbSB0aGUgY2FjaGUuIFRoaXMgaXMgdXNlZnVsIHRvIGRlc3Ryb3lcblx0ICogYSB0ZXh0dXJlIG9yIHNoYWRlciwgYW5kIGhhdmUgaXQgbm8gbG9uZ2VyIHJlLWxvYWQgb24gY29udGV4dCByZXN0b3JlLlxuXHQgKlxuXHQgKiBSZXR1cm5zIHRoZSBvYmplY3QgdGhhdCB3YXMgcmVtb3ZlZCwgb3IgbnVsbCBpZiBpdCB3YXMgbm90IGZvdW5kIGluIHRoZSBjYWNoZS5cblx0ICogXG5cdCAqIEBwYXJhbSAge09iamVjdH0gb2JqIHRoZSBvYmplY3QgdG8gYmUgbWFuYWdlZFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9ICAgICB0aGUgcmVtb3ZlZCBvYmplY3QsIG9yIG51bGxcblx0ICovXG5cdHJlbW92ZU1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHZhciBpZHggPSB0aGlzLm1hbmFnZWRPYmplY3RzLmluZGV4T2Yob2JqKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMubWFuYWdlZE9iamVjdHMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH0gXG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxzIGRlc3Ryb3koKSBvbiBlYWNoIG1hbmFnZWQgb2JqZWN0LCB0aGVuIHJlbW92ZXMgcmVmZXJlbmNlcyB0byB0aGVzZSBvYmplY3RzXG5cdCAqIGFuZCB0aGUgR0wgcmVuZGVyaW5nIGNvbnRleHQuIFRoaXMgYWxzbyByZW1vdmVzIHJlZmVyZW5jZXMgdG8gdGhlIHZpZXcgYW5kIHNldHNcblx0ICogdGhlIGNvbnRleHQncyB3aWR0aCBhbmQgaGVpZ2h0IHRvIHplcm8uXG5cdCAqXG5cdCAqIEF0dGVtcHRpbmcgdG8gdXNlIHRoaXMgV2ViR0xDb250ZXh0IG9yIHRoZSBHTCByZW5kZXJpbmcgY29udGV4dCBhZnRlciBkZXN0cm95aW5nIGl0XG5cdCAqIHdpbGwgbGVhZCB0byB1bmRlZmluZWQgYmVoYXZpb3VyLlxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBvYmogPSB0aGlzLm1hbmFnZWRPYmplY3RzW2ldO1xuXHRcdFx0aWYgKG9iaiAmJiB0eXBlb2Ygb2JqLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIilcblx0XHRcdFx0b2JqLmRlc3Ryb3koKTtcblx0XHR9XG5cdFx0dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGggPSAwO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR0aGlzLnZpZXcgPSBudWxsO1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdH0sXG5cblx0X2NvbnRleHRMb3N0OiBmdW5jdGlvbihldikge1xuXHRcdC8vYWxsIHRleHR1cmVzL3NoYWRlcnMvYnVmZmVycy9GQk9zIGhhdmUgYmVlbiBkZWxldGVkLi4uIFxuXHRcdC8vd2UgbmVlZCB0byByZS1jcmVhdGUgdGhlbSBvbiByZXN0b3JlXG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5sb3N0LmRpc3BhdGNoKHRoaXMpO1xuXHR9LFxuXG5cdF9jb250ZXh0UmVzdG9yZWQ6IGZ1bmN0aW9uKGV2KSB7XG5cdFx0Ly9maXJzdCwgaW5pdGlhbGl6ZSB0aGUgR0wgY29udGV4dCBhZ2FpblxuXHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHQvL25vdyB3ZSByZWNyZWF0ZSBvdXIgc2hhZGVycyBhbmQgdGV4dHVyZXNcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5tYW5hZ2VkT2JqZWN0c1tpXS5jcmVhdGUoKTtcblx0XHR9XG5cblx0XHQvL3VwZGF0ZSBHTCB2aWV3cG9ydFxuXHRcdHRoaXMucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuXHRcdHRoaXMucmVzdG9yZWQuZGlzcGF0Y2godGhpcyk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMQ29udGV4dDsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vVGV4dHVyZScpO1xuXG5cbnZhciBGcmFtZUJ1ZmZlciA9IG5ldyBDbGFzcyh7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgRnJhbWUgQnVmZmVyIE9iamVjdCB3aXRoIHRoZSBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0LlxuXHQgKlxuXHQgKiBJZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub24tbnVtYmVycywgdGhpcyBtZXRob2QgZXhwZWN0cyB0aGVcblx0ICogZmlyc3QgcGFyYW1ldGVyIHRvIGJlIGEgVGV4dHVyZSBvYmplY3Qgd2hpY2ggc2hvdWxkIGJlIGFjdGVkIHVwb24uIFxuXHQgKiBJbiB0aGlzIGNhc2UsIHRoZSBGcmFtZUJ1ZmZlciBkb2VzIG5vdCBcIm93blwiIHRoZSB0ZXh0dXJlLCBhbmQgc28gaXRcblx0ICogd29uJ3QgZGlzcG9zZSBvZiBpdCB1cG9uIGRlc3RydWN0aW9uLiBUaGlzIGlzIGFuIGFkdmFuY2VkIHZlcnNpb24gb2YgdGhlXG5cdCAqIGNvbnN0cnVjdG9yIHRoYXQgYXNzdW1lcyB0aGUgdXNlciBpcyBnaXZpbmcgdXMgYSB2YWxpZCBUZXh0dXJlIHRoYXQgY2FuIGJlIGJvdW5kIChpLmUuXG5cdCAqIG5vIGFzeW5jIEltYWdlIHRleHR1cmVzKS5cblx0ICpcblx0ICogQGNsYXNzICBGcmFtZUJ1ZmZlclxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7W3R5cGVdfSB3aWR0aCAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGhlaWdodCBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gZmlsdGVyIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gRnJhbWVCdWZmZXIoY29udGV4dCwgd2lkdGgsIGhlaWdodCwgZm9ybWF0KSB7IC8vVE9ETzogZGVwdGggY29tcG9uZW50XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gRnJhbWVCdWZmZXJcIjtcblx0XG5cblx0XHQvKipcblx0XHQgKiBUaGUgdW5kZXJseWluZyBJRCBvZiB0aGUgR0wgZnJhbWUgYnVmZmVyIG9iamVjdC5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7V2ViR0xGcmFtZWJ1ZmZlcn0gaWRcblx0XHQgKi9cdFx0XG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgV2ViR0xDb250ZXh0IGJhY2tlZCBieSB0aGlzIGZyYW1lIGJ1ZmZlci5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7V2ViR0xDb250ZXh0fSBjb250ZXh0XG5cdFx0ICovXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBUZXh0dXJlIGJhY2tlZCBieSB0aGlzIGZyYW1lIGJ1ZmZlci5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gVGV4dHVyZVxuXHRcdCAqL1xuXHRcdC8vdGhpcyBUZXh0dXJlIGlzIG5vdyBtYW5hZ2VkLlxuXHRcdHRoaXMudGV4dHVyZSA9IG5ldyBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCk7XG5cblx0XHQvL1RoaXMgaXMgbWFhbmdlZCBieSBXZWJHTENvbnRleHRcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB3aGljaCByZXR1cm5zIHRoZSB3aWR0aCBvZiB0aGUgYmFja2luZyB0ZXh0dXJlLiBcblx0ICogXG5cdCAqIEByZWFkT25seVxuXHQgKiBAcHJvcGVydHkgd2lkdGhcblx0ICogQHR5cGUge051bWJlcn1cblx0ICovXG5cdHdpZHRoOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUud2lkdGhcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHdoaWNoIHJldHVybnMgdGhlIGhlaWdodCBvZiB0aGUgYmFja2luZyB0ZXh0dXJlLiBcblx0ICogXG5cdCAqIEByZWFkT25seVxuXHQgKiBAcHJvcGVydHkgaGVpZ2h0XG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHRoZWlnaHQ6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0fVxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIENhbGxlZCBkdXJpbmcgaW5pdGlhbGl6YXRpb24gdG8gc2V0dXAgdGhlIGZyYW1lIGJ1ZmZlcjsgYWxzbyBjYWxsZWQgb25cblx0ICogY29udGV4dCByZXN0b3JlLiBVc2VycyB3aWxsIG5vdCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS5cblx0ICogXG5cdCAqIEBtZXRob2QgY3JlYXRlXG5cdCAqL1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgdGV4ID0gdGhpcy50ZXh0dXJlO1xuXG5cdFx0Ly93ZSBhc3N1bWUgdGhlIHRleHR1cmUgaGFzIGFscmVhZHkgaGFkIGNyZWF0ZSgpIGNhbGxlZCBvbiBpdFxuXHRcdC8vc2luY2UgaXQgd2FzIGFkZGVkIGFzIGEgbWFuYWdlZCBvYmplY3QgcHJpb3IgdG8gdGhpcyBGcmFtZUJ1ZmZlclxuXHRcdHRleC5iaW5kKCk7XG4gXG5cdFx0dGhpcy5pZCA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmlkKTtcblxuXHRcdGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgdGV4LnRhcmdldCwgdGV4LmlkLCAwKTtcblxuXHRcdHZhciByZXN1bHQgPSBnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKTtcblx0XHRpZiAocmVzdWx0ICE9IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG5cdFx0XHR0aGlzLmRlc3Ryb3koKTsgLy9kZXN0cm95IG91ciByZXNvdXJjZXMgYmVmb3JlIGxlYXZpbmcgdGhpcyBmdW5jdGlvbi4uXG5cblx0XHRcdHZhciBlcnIgPSBcIkZyYW1lYnVmZmVyIG5vdCBjb21wbGV0ZVwiO1xuXHRcdFx0c3dpdGNoIChyZXN1bHQpIHtcblx0XHRcdFx0Y2FzZSBnbC5GUkFNRUJVRkZFUl9VTlNVUFBPUlRFRDpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IHVuc3VwcG9ydGVkXCIpO1xuXHRcdFx0XHRjYXNlIGdsLklOQ09NUExFVEVfRElNRU5TSU9OUzpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IGluY29tcGxldGUgZGltZW5zaW9uc1wiKTtcblx0XHRcdFx0Y2FzZSBnbC5JTkNPTVBMRVRFX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBpbmNvbXBsZXRlIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGNhc2UgZ2wuSU5DT01QTEVURV9NSVNTSU5HX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBtaXNzaW5nIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cdH0sXG5cblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyBmcmFtZSBidWZmZXIuIFVzaW5nIHRoaXMgb2JqZWN0IGFmdGVyIGRlc3Ryb3lpbmcgaXQgd2lsbCBoYXZlXG5cdCAqIHVuZGVmaW5lZCByZXN1bHRzLiBcblx0ICogQG1ldGhvZCBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSlcblx0XHRcdHRoaXMudGV4dHVyZS5kZXN0cm95KCk7XG5cdFx0aWYgKHRoaXMuaWQgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlRnJhbWVidWZmZXIodGhpcy5pZCk7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy50ZXh0dXJlID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGlzIGZyYW1lYnVmZmVyIGFuZCBzZXRzIHRoZSB2aWV3cG9ydCB0byB0aGUgZXhwZWN0ZWQgc2l6ZS5cblx0ICogQG1ldGhvZCBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudmlld3BvcnQoMCwgMCwgdGhpcy50ZXh0dXJlLndpZHRoLCB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuaWQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGUgZGVmYXVsdCBmcmFtZSBidWZmZXIgKHRoZSBzY3JlZW4pIGFuZCBzZXRzIHRoZSB2aWV3cG9ydCBiYWNrXG5cdCAqIHRvIHRoZSBzaXplIG9mIHRoZSBXZWJHTENvbnRleHQuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMuY29udGV4dC53aWR0aCwgdGhpcy5jb250ZXh0LmhlaWdodCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRnJhbWVCdWZmZXI7IiwiLyoqXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxuLy9UT0RPOiBkZWNvdXBsZSBpbnRvIFZCTyArIElCTyB1dGlsaXRpZXMgXG4vKipcbiAqIEEgbWVzaCBjbGFzcyB0aGF0IHdyYXBzIFZCTyBhbmQgSUJPLlxuICpcbiAqIEBjbGFzcyAgTWVzaFxuICovXG52YXIgTWVzaCA9IG5ldyBDbGFzcyh7XG5cblxuXHQvKipcblx0ICogQSB3cml0ZS1vbmx5IHByb3BlcnR5IHdoaWNoIHNldHMgYm90aCB2ZXJ0aWNlcyBhbmQgaW5kaWNlcyBcblx0ICogZmxhZyB0byBkaXJ0eSBvciBub3QuIFxuXHQgKlxuXHQgKiBAcHJvcGVydHkgZGlydHlcblx0ICogQHR5cGUge0Jvb2xlYW59XG5cdCAqIEB3cml0ZU9ubHlcblx0ICovXG5cdGRpcnR5OiB7XG5cdFx0c2V0OiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdHRoaXMudmVydGljZXNEaXJ0eSA9IHZhbDtcblx0XHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdmFsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBNZXNoIHdpdGggdGhlIHByb3ZpZGVkIHBhcmFtZXRlcnMuXG5cdCAqXG5cdCAqIElmIG51bUluZGljZXMgaXMgMCBvciBmYWxzeSwgbm8gaW5kZXggYnVmZmVyIHdpbGwgYmUgdXNlZFxuXHQgKiBhbmQgaW5kaWNlcyB3aWxsIGJlIGFuIGVtcHR5IEFycmF5QnVmZmVyIGFuZCBhIG51bGwgaW5kZXhCdWZmZXIuXG5cdCAqIFxuXHQgKiBJZiBpc1N0YXRpYyBpcyB0cnVlLCB0aGVuIHZlcnRleFVzYWdlIGFuZCBpbmRleFVzYWdlIHdpbGxcblx0ICogYmUgc2V0IHRvIGdsLlNUQVRJQ19EUkFXLiBPdGhlcndpc2UgdGhleSB3aWxsIHVzZSBnbC5EWU5BTUlDX0RSQVcuXG5cdCAqIFlvdSBtYXkgd2FudCB0byBhZGp1c3QgdGhlc2UgYWZ0ZXIgaW5pdGlhbGl6YXRpb24gZm9yIGZ1cnRoZXIgY29udHJvbC5cblx0ICogXG5cdCAqIEBwYXJhbSAge1dlYkdMQ29udGV4dH0gIGNvbnRleHQgdGhlIGNvbnRleHQgZm9yIG1hbmFnZW1lbnRcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gaXNTdGF0aWMgICAgICBhIGhpbnQgYXMgdG8gd2hldGhlciB0aGlzIGdlb21ldHJ5IGlzIHN0YXRpY1xuXHQgKiBAcGFyYW0gIHtbdHlwZV19ICBudW1WZXJ0cyAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSAgbnVtSW5kaWNlcyAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gIHZlcnRleEF0dHJpYnMgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIE1lc2goY29udGV4dCwgaXNTdGF0aWMsIG51bVZlcnRzLCBudW1JbmRpY2VzLCB2ZXJ0ZXhBdHRyaWJzKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gTWVzaFwiO1xuXHRcdGlmICghbnVtVmVydHMpXG5cdFx0XHR0aHJvdyBcIm51bVZlcnRzIG5vdCBzcGVjaWZpZWQsIG11c3QgYmUgPiAwXCI7XG5cblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdHRoaXMuZ2wgPSBjb250ZXh0LmdsO1xuXHRcdFxuXHRcdHRoaXMubnVtVmVydHMgPSBudWxsO1xuXHRcdHRoaXMubnVtSW5kaWNlcyA9IG51bGw7XG5cdFx0XG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG51bGw7XG5cdFx0dGhpcy5pbmRpY2VzID0gbnVsbDtcblx0XHR0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG5cdFx0dGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG5cblx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLmluZGV4VXNhZ2UgPSBudWxsO1xuXHRcdHRoaXMudmVydGV4VXNhZ2UgPSBudWxsO1xuXG5cdFx0LyoqIFxuXHRcdCAqIEBwcm9wZXJ0eVxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICovXG5cdFx0dGhpcy5fdmVydGV4QXR0cmlicyA9IG51bGw7XG5cblx0XHQvKiogXG5cdFx0ICogVGhlIHN0cmlkZSBmb3Igb25lIHZlcnRleCBfaW4gYnl0ZXNfLiBcblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gdmVydGV4U3RyaWRlXG5cdFx0ICovXG5cdFx0dGhpcy52ZXJ0ZXhTdHJpZGUgPSBudWxsO1xuXG5cdFx0dGhpcy5udW1WZXJ0cyA9IG51bVZlcnRzO1xuXHRcdHRoaXMubnVtSW5kaWNlcyA9IG51bUluZGljZXMgfHwgMDtcblx0XHR0aGlzLnZlcnRleFVzYWdlID0gaXNTdGF0aWMgPyB0aGlzLmdsLlNUQVRJQ19EUkFXIDogdGhpcy5nbC5EWU5BTUlDX0RSQVc7XG5cdFx0dGhpcy5pbmRleFVzYWdlICA9IGlzU3RhdGljID8gdGhpcy5nbC5TVEFUSUNfRFJBVyA6IHRoaXMuZ2wuRFlOQU1JQ19EUkFXO1xuXHRcdHRoaXMuX3ZlcnRleEF0dHJpYnMgPSB2ZXJ0ZXhBdHRyaWJzIHx8IFtdO1xuXHRcdFxuXHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXG5cdFx0Ly9kZXRlcm1pbmUgdGhlIHZlcnRleCBzdHJpZGUgYmFzZWQgb24gZ2l2ZW4gYXR0cmlidXRlc1xuXHRcdHZhciB0b3RhbE51bUNvbXBvbmVudHMgPSAwO1xuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKVxuXHRcdFx0dG90YWxOdW1Db21wb25lbnRzICs9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV0ub2Zmc2V0Q291bnQ7XG5cdFx0dGhpcy52ZXJ0ZXhTdHJpZGUgPSB0b3RhbE51bUNvbXBvbmVudHMgKiA0OyAvLyBpbiBieXRlc1xuXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1WZXJ0cyk7XG5cdFx0dGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHRoaXMubnVtSW5kaWNlcyk7XG5cblx0XHQvL2FkZCB0aGlzIFZCTyB0byB0aGUgbWFuYWdlZCBjYWNoZVxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvL3JlY3JlYXRlcyB0aGUgYnVmZmVycyBvbiBjb250ZXh0IGxvc3Ncblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuXHRcdC8vaWdub3JlIGluZGV4IGJ1ZmZlciBpZiB3ZSBoYXZlbid0IHNwZWNpZmllZCBhbnlcblx0XHR0aGlzLmluZGV4QnVmZmVyID0gdGhpcy5udW1JbmRpY2VzID4gMFxuXHRcdFx0XHRcdD8gZ2wuY3JlYXRlQnVmZmVyKClcblx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0fSxcblxuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRpY2VzID0gbnVsbDtcblx0XHR0aGlzLmluZGljZXMgPSBudWxsO1xuXHRcdGlmICh0aGlzLnZlcnRleEJ1ZmZlciAmJiB0aGlzLmdsKVxuXHRcdFx0dGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXHRcdGlmICh0aGlzLmluZGV4QnVmZmVyICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLmluZGV4QnVmZmVyKTtcblx0XHR0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG5cdFx0dGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblx0X3VwZGF0ZUJ1ZmZlcnM6IGZ1bmN0aW9uKGlnbm9yZUJpbmQsIHN1YkRhdGFMZW5ndGgpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Ly9iaW5kIG91ciBpbmRleCBkYXRhLCBpZiB3ZSBoYXZlIGFueVxuXHRcdGlmICh0aGlzLm51bUluZGljZXMgPiAwKSB7XG5cdFx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHRcdGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kZXhCdWZmZXIpO1xuXG5cdFx0XHQvL3VwZGF0ZSB0aGUgaW5kZXggZGF0YVxuXHRcdFx0aWYgKHRoaXMuaW5kaWNlc0RpcnR5KSB7XG5cdFx0XHRcdGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kaWNlcywgdGhpcy5pbmRleFVzYWdlKTtcblx0XHRcdFx0dGhpcy5pbmRpY2VzRGlydHkgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2JpbmQgb3VyIHZlcnRleCBkYXRhXG5cdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcblxuXHRcdC8vdXBkYXRlIG91ciB2ZXJ0ZXggZGF0YVxuXHRcdGlmICh0aGlzLnZlcnRpY2VzRGlydHkpIHtcblx0XHRcdGlmIChzdWJEYXRhTGVuZ3RoKSB7XG5cdFx0XHRcdC8vIFRPRE86IFdoZW4gZGVjb3VwbGluZyBWQk8vSUJPIGJlIHN1cmUgdG8gZ2l2ZSBiZXR0ZXIgc3ViRGF0YSBzdXBwb3J0Li5cblx0XHRcdFx0dmFyIHZpZXcgPSB0aGlzLnZlcnRpY2VzLnN1YmFycmF5KDAsIHN1YkRhdGFMZW5ndGgpO1xuXHRcdFx0XHRnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdmlldyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0aWNlcywgdGhpcy52ZXJ0ZXhVc2FnZSk7XHRcblx0XHRcdH1cblxuXHRcdFx0XG5cdFx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSBmYWxzZTtcblx0XHR9XG5cdH0sXG5cblx0ZHJhdzogZnVuY3Rpb24ocHJpbWl0aXZlVHlwZSwgY291bnQsIG9mZnNldCwgc3ViRGF0YUxlbmd0aCkge1xuXHRcdGlmIChjb3VudCA9PT0gMClcblx0XHRcdHJldHVybjtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0XG5cdFx0b2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cblx0XHQvL2JpbmRzIGFuZCB1cGRhdGVzIG91ciBidWZmZXJzLiBwYXNzIGlnbm9yZUJpbmQgYXMgdHJ1ZVxuXHRcdC8vdG8gYXZvaWQgYmluZGluZyB1bm5lY2Vzc2FyaWx5XG5cdFx0dGhpcy5fdXBkYXRlQnVmZmVycyh0cnVlLCBzdWJEYXRhTGVuZ3RoKTtcblxuXHRcdGlmICh0aGlzLm51bUluZGljZXMgPiAwKSB7IFxuXHRcdFx0Z2wuZHJhd0VsZW1lbnRzKHByaW1pdGl2ZVR5cGUsIGNvdW50LCBcblx0XHRcdFx0XHRcdGdsLlVOU0lHTkVEX1NIT1JULCBvZmZzZXQgKiAyKTsgLy8qIFVpbnQxNkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UXG5cdFx0fSBlbHNlXG5cdFx0XHRnbC5kcmF3QXJyYXlzKHByaW1pdGl2ZVR5cGUsIG9mZnNldCwgY291bnQpO1xuXHR9LFxuXG5cdC8vYmluZHMgdGhpcyBtZXNoJ3MgdmVydGV4IGF0dHJpYnV0ZXMgZm9yIHRoZSBnaXZlbiBzaGFkZXJcblx0YmluZDogZnVuY3Rpb24oc2hhZGVyKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBvZmZzZXQgPSAwO1xuXHRcdHZhciBzdHJpZGUgPSB0aGlzLnZlcnRleFN0cmlkZTtcblxuXHRcdC8vYmluZCBhbmQgdXBkYXRlIG91ciB2ZXJ0ZXggZGF0YSBiZWZvcmUgYmluZGluZyBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5fdXBkYXRlQnVmZmVycygpO1xuXG5cdFx0Ly9mb3IgZWFjaCBhdHRyaWJ0dWVcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGEgPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldO1xuXG5cdFx0XHQvL2xvY2F0aW9uIG9mIHRoZSBhdHRyaWJ1dGVcblx0XHRcdHZhciBsb2MgPSBhLmxvY2F0aW9uID09PSBudWxsIFxuXHRcdFx0XHRcdD8gc2hhZGVyLmdldEF0dHJpYnV0ZUxvY2F0aW9uKGEubmFtZSlcblx0XHRcdFx0XHQ6IGEubG9jYXRpb247XG5cblx0XHRcdC8vVE9ETzogV2UgbWF5IHdhbnQgdG8gc2tpcCB1bmZvdW5kIGF0dHJpYnNcblx0XHRcdC8vIGlmIChsb2MhPT0wICYmICFsb2MpXG5cdFx0XHQvLyBcdGNvbnNvbGUud2FybihcIldBUk46XCIsIGEubmFtZSwgXCJpcyBub3QgZW5hYmxlZFwiKTtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cblx0XHRcdC8vdGhlbiBzcGVjaWZ5IG91ciB2ZXJ0ZXggZm9ybWF0XG5cdFx0XHRnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgYS5udW1Db21wb25lbnRzLCBhLnR5cGUgfHwgZ2wuRkxPQVQsIFxuXHRcdFx0XHRcdFx0XHRcdCAgIGEubm9ybWFsaXplLCBzdHJpZGUsIG9mZnNldCk7XG5cblx0XHRcdC8vYW5kIGluY3JlYXNlIHRoZSBvZmZzZXQuLi5cblx0XHRcdG9mZnNldCArPSBhLm9mZnNldENvdW50ICogNDsgLy9pbiBieXRlc1xuXHRcdH1cblx0fSxcblxuXHR1bmJpbmQ6IGZ1bmN0aW9uKHNoYWRlcikge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL2ZvciBlYWNoIGF0dHJpYnR1ZVxuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgYSA9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV07XG5cblx0XHRcdC8vbG9jYXRpb24gb2YgdGhlIGF0dHJpYnV0ZVxuXHRcdFx0dmFyIGxvYyA9IGEubG9jYXRpb24gPT09IG51bGwgXG5cdFx0XHRcdFx0PyBzaGFkZXIuZ2V0QXR0cmlidXRlTG9jYXRpb24oYS5uYW1lKVxuXHRcdFx0XHRcdDogYS5sb2NhdGlvbjtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXHRcdH1cblx0fVxufSk7XG5cbk1lc2guQXR0cmliID0gbmV3IENsYXNzKHtcblxuXHRuYW1lOiBudWxsLFxuXHRudW1Db21wb25lbnRzOiBudWxsLFxuXHRsb2NhdGlvbjogbnVsbCxcblx0dHlwZTogbnVsbCxcblxuXHQvKipcblx0ICogTG9jYXRpb24gaXMgb3B0aW9uYWwgYW5kIGZvciBhZHZhbmNlZCB1c2VycyB0aGF0XG5cdCAqIHdhbnQgdmVydGV4IGFycmF5cyB0byBtYXRjaCBhY3Jvc3Mgc2hhZGVycy4gQW55IG5vbi1udW1lcmljYWxcblx0ICogdmFsdWUgd2lsbCBiZSBjb252ZXJ0ZWQgdG8gbnVsbCwgYW5kIGlnbm9yZWQuIElmIGEgbnVtZXJpY2FsXG5cdCAqIHZhbHVlIGlzIGdpdmVuLCBpdCB3aWxsIG92ZXJyaWRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIGF0dHJpYnV0ZVxuXHQgKiB3aGVuIGdpdmVuIHRvIGEgbWVzaC5cblx0ICogXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbmFtZSAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbnVtQ29tcG9uZW50cyBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbG9jYXRpb24gICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbihuYW1lLCBudW1Db21wb25lbnRzLCBsb2NhdGlvbiwgdHlwZSwgbm9ybWFsaXplLCBvZmZzZXRDb3VudCkge1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5udW1Db21wb25lbnRzID0gbnVtQ29tcG9uZW50cztcblx0XHR0aGlzLmxvY2F0aW9uID0gdHlwZW9mIGxvY2F0aW9uID09PSBcIm51bWJlclwiID8gbG9jYXRpb24gOiBudWxsO1xuXHRcdHRoaXMudHlwZSA9IHR5cGU7XG5cdFx0dGhpcy5ub3JtYWxpemUgPSBCb29sZWFuKG5vcm1hbGl6ZSk7XG5cdFx0dGhpcy5vZmZzZXRDb3VudCA9IHR5cGVvZiBvZmZzZXRDb3VudCA9PT0gXCJudW1iZXJcIiA/IG9mZnNldENvdW50IDogdGhpcy5udW1Db21wb25lbnRzO1xuXHR9XG59KVxuXG5cbm1vZHVsZS5leHBvcnRzID0gTWVzaDsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG5cbnZhciBTaGFkZXJQcm9ncmFtID0gbmV3IENsYXNzKHtcblx0XG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFNoYWRlclByb2dyYW0gZnJvbSB0aGUgZ2l2ZW4gc291cmNlLCBhbmQgYW4gb3B0aW9uYWwgbWFwIG9mIGF0dHJpYnV0ZVxuXHQgKiBsb2NhdGlvbnMgYXMgPG5hbWUsIGluZGV4PiBwYWlycy5cblx0ICpcblx0ICogX05vdGU6XyBDaHJvbWUgdmVyc2lvbiAzMSB3YXMgZ2l2aW5nIG1lIGlzc3VlcyB3aXRoIGF0dHJpYnV0ZSBsb2NhdGlvbnMgLS0geW91IG1heVxuXHQgKiB3YW50IHRvIG9taXQgdGhpcyB0byBsZXQgdGhlIGJyb3dzZXIgcGljayB0aGUgbG9jYXRpb25zIGZvciB5b3UuXHRcblx0ICpcblx0ICogQGNsYXNzICBTaGFkZXJQcm9ncmFtXG5cdCAqIEBjb25zdHJ1Y3RvclxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9IGNvbnRleHQgICAgICB0aGUgY29udGV4dCB0byBtYW5hZ2UgdGhpcyBvYmplY3Rcblx0ICogQHBhcmFtICB7U3RyaW5nfSB2ZXJ0U291cmNlICAgICAgICAgdGhlIHZlcnRleCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gZnJhZ1NvdXJjZSAgICAgICAgIHRoZSBmcmFnbWVudCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge09iamVjdH0gYXR0cmlidXRlTG9jYXRpb25zIHRoZSBhdHRyaWJ1dGUgbG9jYXRpb25zXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBTaGFkZXJQcm9ncmFtKGNvbnRleHQsIHZlcnRTb3VyY2UsIGZyYWdTb3VyY2UsIGF0dHJpYnV0ZUxvY2F0aW9ucykge1xuXHRcdGlmICghdmVydFNvdXJjZSB8fCAhZnJhZ1NvdXJjZSlcblx0XHRcdHRocm93IFwidmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzIG11c3QgYmUgZGVmaW5lZFwiO1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNoYWRlclByb2dyYW1cIjtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0dGhpcy52ZXJ0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSBudWxsO1xuXHRcdHRoaXMucHJvZ3JhbSA9IG51bGw7XG5cdFx0dGhpcy5sb2cgPSBcIlwiO1xuXG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMuYXR0cmlidXRlQ2FjaGUgPSBudWxsO1xuXG5cdFx0dGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMgPSBhdHRyaWJ1dGVMb2NhdGlvbnM7XG5cblx0XHQvL1dlIHRyaW0gKEVDTUFTY3JpcHQ1KSBzbyB0aGF0IHRoZSBHTFNMIGxpbmUgbnVtYmVycyBhcmVcblx0XHQvL2FjY3VyYXRlIG9uIHNoYWRlciBsb2dcblx0XHR0aGlzLnZlcnRTb3VyY2UgPSB2ZXJ0U291cmNlLnRyaW0oKTtcblx0XHR0aGlzLmZyYWdTb3VyY2UgPSBmcmFnU291cmNlLnRyaW0oKTtcblxuXHRcdC8vQWRkcyB0aGlzIHNoYWRlciB0byB0aGUgY29udGV4dCwgdG8gYmUgbWFuYWdlZFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKiogXG5cdCAqIFRoaXMgaXMgY2FsbGVkIGR1cmluZyB0aGUgU2hhZGVyUHJvZ3JhbSBjb25zdHJ1Y3Rvcixcblx0ICogYW5kIG1heSBuZWVkIHRvIGJlIGNhbGxlZCBhZ2FpbiBhZnRlciBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBjcmVhdGVcblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR0aGlzLl9jb21waWxlU2hhZGVycygpO1xuXHR9LFxuXG5cdC8vQ29tcGlsZXMgdGhlIHNoYWRlcnMsIHRocm93aW5nIGFuIGVycm9yIGlmIHRoZSBwcm9ncmFtIHdhcyBpbnZhbGlkLlxuXHRfY29tcGlsZVNoYWRlcnM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXHRcdFxuXHRcdHRoaXMubG9nID0gXCJcIjtcblxuXHRcdHRoaXMudmVydFNoYWRlciA9IHRoaXMuX2xvYWRTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUiwgdGhpcy52ZXJ0U291cmNlKTtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSB0aGlzLl9sb2FkU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUiwgdGhpcy5mcmFnU291cmNlKTtcblxuXHRcdGlmICghdGhpcy52ZXJ0U2hhZGVyIHx8ICF0aGlzLmZyYWdTaGFkZXIpXG5cdFx0XHR0aHJvdyBcIkVycm9yIHJldHVybmVkIHdoZW4gY2FsbGluZyBjcmVhdGVTaGFkZXJcIjtcblxuXHRcdHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcblxuXHRcdGdsLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMudmVydFNoYWRlcik7XG5cdFx0Z2wuYXR0YWNoU2hhZGVyKHRoaXMucHJvZ3JhbSwgdGhpcy5mcmFnU2hhZGVyKTtcblx0XG5cdFx0Ly9UT0RPOiBUaGlzIHNlZW1zIG5vdCB0byBiZSB3b3JraW5nIG9uIG15IE9TWCAtLSBtYXliZSBhIGRyaXZlciBidWc/XG5cdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRnbC5iaW5kQXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBNYXRoLmZsb29yKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zW2tleV0pLCBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Z2wubGlua1Byb2dyYW0odGhpcy5wcm9ncmFtKTsgXG5cblx0XHR0aGlzLmxvZyArPSBnbC5nZXRQcm9ncmFtSW5mb0xvZyh0aGlzLnByb2dyYW0pIHx8IFwiXCI7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRcdHRocm93IFwiRXJyb3IgbGlua2luZyB0aGUgc2hhZGVyIHByb2dyYW06XFxuXCJcblx0XHRcdFx0KyB0aGlzLmxvZztcblx0XHR9XG5cblx0XHR0aGlzLl9mZXRjaFVuaWZvcm1zKCk7XG5cdFx0dGhpcy5fZmV0Y2hBdHRyaWJ1dGVzKCk7XG5cdH0sXG5cblx0X2ZldGNoVW5pZm9ybXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuXHRcdGlmICghbGVuKSAvL251bGwgb3IgemVyb1xuXHRcdFx0cmV0dXJuO1xuXG5cdFx0Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgaW5mbyA9IGdsLmdldEFjdGl2ZVVuaWZvcm0odGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblx0XHRcdHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVuaWZvcm1DYWNoZVtuYW1lXSA9IHtcblx0XHRcdFx0c2l6ZTogaW5mby5zaXplLFxuXHRcdFx0XHR0eXBlOiBpbmZvLnR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvblxuXHRcdFx0fTtcblx0XHR9XG5cdH0sXG5cblx0X2ZldGNoQXR0cmlidXRlczogZnVuY3Rpb24oKSB7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG5cdFx0aWYgKCFsZW4pIC8vbnVsbCBvciB6ZXJvXG5cdFx0XHRyZXR1cm47XHRcblxuXHRcdGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0dmFyIGluZm8gPSBnbC5nZXRBY3RpdmVBdHRyaWIodGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblxuXHRcdFx0Ly90aGUgYXR0cmliIGxvY2F0aW9uIGlzIGEgc2ltcGxlIGluZGV4XG5cdFx0XHR2YXIgbG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlW25hbWVdID0ge1xuXHRcdFx0XHRzaXplOiBpbmZvLnNpemUsXG5cdFx0XHRcdHR5cGU6IGluZm8udHlwZSxcblx0XHRcdFx0bG9jYXRpb246IGxvY2F0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0fSxcblxuXHRfbG9hZFNoYWRlcjogZnVuY3Rpb24odHlwZSwgc291cmNlKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSk7XG5cdFx0aWYgKCFzaGFkZXIpIC8vc2hvdWxkIG5vdCBvY2N1ci4uLlxuXHRcdFx0cmV0dXJuIC0xO1xuXG5cdFx0Z2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcblx0XHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cdFx0XG5cdFx0dmFyIGxvZ1Jlc3VsdCA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSB8fCBcIlwiO1xuXHRcdGlmIChsb2dSZXN1bHQpIHtcblx0XHRcdC8vd2UgZG8gdGhpcyBzbyB0aGUgdXNlciBrbm93cyB3aGljaCBzaGFkZXIgaGFzIHRoZSBlcnJvclxuXHRcdFx0dmFyIHR5cGVTdHIgPSAodHlwZSA9PT0gZ2wuVkVSVEVYX1NIQURFUikgPyBcInZlcnRleFwiIDogXCJmcmFnbWVudFwiO1xuXHRcdFx0bG9nUmVzdWx0ID0gXCJFcnJvciBjb21waWxpbmcgXCIrIHR5cGVTdHIrIFwiIHNoYWRlcjpcXG5cIitsb2dSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2cgKz0gbG9nUmVzdWx0O1xuXG5cdFx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykgKSB7XG5cdFx0XHR0aHJvdyB0aGlzLmxvZztcblx0XHR9XG5cdFx0cmV0dXJuIHNoYWRlcjtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIHRvIGJpbmQgdGhpcyBzaGFkZXIuIE5vdGUgdGhhdCB0aGVyZSBpcyBubyBcInVuYmluZFwiIHNpbmNlXG5cdCAqIHRlY2huaWNhbGx5IHN1Y2ggYSB0aGluZyBpcyBub3QgcG9zc2libGUgaW4gdGhlIHByb2dyYW1tYWJsZSBwaXBlbGluZS5cblx0ICpcblx0ICogWW91IG11c3QgYmluZCBhIHNoYWRlciBiZWZvcmUgc2V0dGluZ3MgaXRzIHVuaWZvcm1zLlxuXHQgKiBcblx0ICogQG1ldGhvZCBiaW5kXG5cdCAqL1xuXHRiaW5kOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGlzIHNoYWRlciBhbmQgaXRzIHJlc291cmNlcy4gWW91IHNob3VsZCBub3QgdHJ5IHRvIHVzZSB0aGlzXG5cdCAqIGFmdGVyIGRlc3Ryb3lpbmcgaXQuXG5cdCAqIEBtZXRob2QgIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdGlmICh0aGlzLmdsICYmIHRoaXMucHJvZ3JhbSkge1xuXHRcdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRcdGdsLmRldGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZXRhY2hTaGFkZXIodGhpcy5wcm9ncmFtLCB0aGlzLmZyYWdTaGFkZXIpO1xuXG5cdFx0XHRnbC5kZWxldGVTaGFkZXIodGhpcy52ZXJ0U2hhZGVyKTtcblx0XHRcdGdsLmRlbGV0ZVNoYWRlcih0aGlzLmZyYWdTaGFkZXIpO1xuXHRcdFx0Z2wuZGVsZXRlUHJvZ3JhbSh0aGlzLnByb2dyYW0pO1xuXHRcdH1cblx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlID0gbnVsbDtcblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IG51bGw7XG5cdFx0dGhpcy52ZXJ0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSBudWxsO1xuXHRcdHRoaXMucHJvZ3JhbSA9IG51bGw7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gbnVsbDtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBjYWNoZWQgdW5pZm9ybSBpbmZvIChzaXplLCB0eXBlLCBsb2NhdGlvbikuXG5cdCAqIElmIHRoZSB1bmlmb3JtIGlzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGl0IGlzIGFzc3VtZWRcblx0ICogdG8gbm90IGV4aXN0LCBhbmQgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBUaGlzIG1heSByZXR1cm4gbnVsbCBldmVuIGlmIHRoZSB1bmlmb3JtIGlzIGRlZmluZWQgaW4gR0xTTDpcblx0ICogaWYgaXQgaXMgX2luYWN0aXZlXyAoaS5lLiBub3QgdXNlZCBpbiB0aGUgcHJvZ3JhbSkgdGhlbiBpdCBtYXlcblx0ICogYmUgb3B0aW1pemVkIG91dC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUluZm9cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge09iamVjdH0gYW4gb2JqZWN0IGNvbnRhaW5pbmcgbG9jYXRpb24sIHNpemUsIGFuZCB0eXBlXG5cdCAqL1xuXHRnZXRVbmlmb3JtSW5mbzogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLnVuaWZvcm1DYWNoZVtuYW1lXSB8fCBudWxsOyBcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIGF0dHJpYnV0ZSBpbmZvIChzaXplLCB0eXBlLCBsb2NhdGlvbikuXG5cdCAqIElmIHRoZSBhdHRyaWJ1dGUgaXMgbm90IGZvdW5kIGluIHRoZSBjYWNoZSwgaXQgaXMgYXNzdW1lZFxuXHQgKiB0byBub3QgZXhpc3QsIGFuZCB0aGlzIG1ldGhvZCByZXR1cm5zIG51bGwuXG5cdCAqXG5cdCAqIFRoaXMgbWF5IHJldHVybiBudWxsIGV2ZW4gaWYgdGhlIGF0dHJpYnV0ZSBpcyBkZWZpbmVkIGluIEdMU0w6XG5cdCAqIGlmIGl0IGlzIF9pbmFjdGl2ZV8gKGkuZS4gbm90IHVzZWQgaW4gdGhlIHByb2dyYW0gb3IgZGlzYWJsZWQpIFxuXHQgKiB0aGVuIGl0IG1heSBiZSBvcHRpbWl6ZWQgb3V0LlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRBdHRyaWJ1dGVJbmZvXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgYXR0cmlidXRlIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge29iamVjdH0gYW4gb2JqZWN0IGNvbnRhaW5pbmcgbG9jYXRpb24sIHNpemUgYW5kIHR5cGVcblx0ICovXG5cdGdldEF0dHJpYnV0ZUluZm86IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5hdHRyaWJ1dGVDYWNoZVtuYW1lXSB8fCBudWxsOyBcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBjYWNoZWQgdW5pZm9ybSBsb2NhdGlvbiBvYmplY3QuXG5cdCAqIElmIHRoZSB1bmlmb3JtIGlzIG5vdCBmb3VuZCwgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRBdHRyaWJ1dGVMb2NhdGlvblxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIHVuaWZvcm0gbmFtZSBhcyBkZWZpbmVkIGluIEdMU0xcblx0ICogQHJldHVybiB7R0xpbnR9IHRoZSBsb2NhdGlvbiBvYmplY3Rcblx0ICovXG5cdGdldEF0dHJpYnV0ZUxvY2F0aW9uOiBmdW5jdGlvbihuYW1lKSB7IC8vVE9ETzogbWFrZSBmYXN0ZXIsIGRvbid0IGNhY2hlXG5cdFx0dmFyIGluZm8gPSB0aGlzLmdldEF0dHJpYnV0ZUluZm8obmFtZSk7XG5cdFx0cmV0dXJuIGluZm8gPyBpbmZvLmxvY2F0aW9uIDogbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gbG9jYXRpb24gb2JqZWN0LCBhc3N1bWluZyBpdCBleGlzdHNcblx0ICogYW5kIGlzIGFjdGl2ZS4gTm90ZSB0aGF0IHVuaWZvcm1zIG1heSBiZSBpbmFjdGl2ZSBpZiBcblx0ICogdGhlIEdMU0wgY29tcGlsZXIgZGVlbWVkIHRoZW0gdW51c2VkLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtTG9jYXRpb25cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge1dlYkdMVW5pZm9ybUxvY2F0aW9ufSB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqL1xuXHRnZXRVbmlmb3JtTG9jYXRpb246IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHR2YXIgaW5mbyA9IHRoaXMuZ2V0VW5pZm9ybUluZm8obmFtZSk7XG5cdFx0cmV0dXJuIGluZm8gPyBpbmZvLmxvY2F0aW9uIDogbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSB1bmlmb3JtIGlzIGFjdGl2ZSBhbmQgZm91bmQgaW4gdGhpc1xuXHQgKiBjb21waWxlZCBwcm9ncmFtLiBOb3RlIHRoYXQgdW5pZm9ybXMgbWF5IGJlIGluYWN0aXZlIGlmIFxuXHQgKiB0aGUgR0xTTCBjb21waWxlciBkZWVtZWQgdGhlbSB1bnVzZWQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGhhc1VuaWZvcm1cblx0ICogQHBhcmFtICB7U3RyaW5nfSAgbmFtZSB0aGUgdW5pZm9ybSBuYW1lXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgdGhlIHVuaWZvcm0gaXMgZm91bmQgYW5kIGFjdGl2ZVxuXHQgKi9cblx0aGFzVW5pZm9ybTogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdldFVuaWZvcm1JbmZvKG5hbWUpICE9PSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGF0dHJpYnV0ZSBpcyBhY3RpdmUgYW5kIGZvdW5kIGluIHRoaXNcblx0ICogY29tcGlsZWQgcHJvZ3JhbS5cblx0ICpcblx0ICogQG1ldGhvZCAgaGFzQXR0cmlidXRlXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgdGhlIGF0dHJpYnV0ZSBuYW1lXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IHRydWUgaWYgdGhlIGF0dHJpYnV0ZSBpcyBmb3VuZCBhbmQgYWN0aXZlXG5cdCAqL1xuXHRoYXNBdHRyaWJ1dGU6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRBdHRyaWJ1dGVJbmZvKG5hbWUpICE9PSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSB1bmlmb3JtIHZhbHVlIGJ5IG5hbWUuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFVuaWZvcm1cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge2FueX0gVGhlIHZhbHVlIG9mIHRoZSBXZWJHTCB1bmlmb3JtXG5cdCAqL1xuXHRnZXRVbmlmb3JtOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2wuZ2V0VW5pZm9ybSh0aGlzLnByb2dyYW0sIHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpKTtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdW5pZm9ybSB2YWx1ZSBhdCB0aGUgc3BlY2lmaWVkIFdlYkdMVW5pZm9ybUxvY2F0aW9uLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtQXRcblx0ICogQHBhcmFtICB7V2ViR0xVbmlmb3JtTG9jYXRpb259IGxvY2F0aW9uIHRoZSBsb2NhdGlvbiBvYmplY3Rcblx0ICogQHJldHVybiB7YW55fSBUaGUgdmFsdWUgb2YgdGhlIFdlYkdMIHVuaWZvcm1cblx0ICovXG5cdGdldFVuaWZvcm1BdDogZnVuY3Rpb24obG9jYXRpb24pIHtcblx0XHRyZXR1cm4gdGhpcy5nbC5nZXRVbmlmb3JtKHRoaXMucHJvZ3JhbSwgbG9jYXRpb24pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIG1ldGhvZCB0byBzZXQgdW5pZm9ybWkgZnJvbSB0aGUgZ2l2ZW4gYXJndW1lbnRzLlxuXHQgKiBXZSBkZXRlcm1pbmUgd2hpY2ggR0wgY2FsbCB0byBtYWtlIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzXG5cdCAqIHBhc3NlZC4gRm9yIGV4YW1wbGUsIGBzZXRVbmlmb3JtaShcInZhclwiLCAwLCAxKWAgbWFwcyB0byBgZ2wudW5pZm9ybTJpYC5cblx0ICogXG5cdCAqIEBtZXRob2QgIHNldFVuaWZvcm1pXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgICAgICBcdFx0dGhlIG5hbWUgb2YgdGhlIHVuaWZvcm1cblx0ICogQHBhcmFtIHtHTGludH0geCAgdGhlIHggY29tcG9uZW50IGZvciBpbnRzXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHkgIHRoZSB5IGNvbXBvbmVudCBmb3IgaXZlYzJcblx0ICogQHBhcmFtIHtHTGludH0geiAgdGhlIHogY29tcG9uZW50IGZvciBpdmVjM1xuXHQgKiBAcGFyYW0ge0dMaW50fSB3ICB0aGUgdyBjb21wb25lbnQgZm9yIGl2ZWM0XG5cdCAqL1xuXHRzZXRVbmlmb3JtaTogZnVuY3Rpb24obmFtZSwgeCwgeSwgeiwgdykge1xuXHRcdCd1c2Ugc3RyaWN0Jztcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAobG9jID09PSBudWxsKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0Y2FzZSAyOiBnbC51bmlmb3JtMWkobG9jLCB4KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDM6IGdsLnVuaWZvcm0yaShsb2MsIHgsIHkpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTNpKGxvYywgeCwgeSwgeik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA1OiBnbC51bmlmb3JtNGkobG9jLCB4LCB5LCB6LCB3KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1pXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1mIGZyb20gdGhlIGdpdmVuIGFyZ3VtZW50cy5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50c1xuXHQgKiBwYXNzZWQuIEZvciBleGFtcGxlLCBgc2V0VW5pZm9ybWYoXCJ2YXJcIiwgMCwgMSlgIG1hcHMgdG8gYGdsLnVuaWZvcm0yZmAuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtZlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7R0xmbG9hdH0geCAgdGhlIHggY29tcG9uZW50IGZvciBmbG9hdHNcblx0ICogQHBhcmFtIHtHTGZsb2F0fSB5ICB0aGUgeSBjb21wb25lbnQgZm9yIHZlYzJcblx0ICogQHBhcmFtIHtHTGZsb2F0fSB6ICB0aGUgeiBjb21wb25lbnQgZm9yIHZlYzNcblx0ICogQHBhcmFtIHtHTGZsb2F0fSB3ICB0aGUgdyBjb21wb25lbnQgZm9yIHZlYzRcblx0ICovXG5cdHNldFVuaWZvcm1mOiBmdW5jdGlvbihuYW1lLCB4LCB5LCB6LCB3KSB7XG5cdFx0J3VzZSBzdHJpY3QnO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmIChsb2MgPT09IG51bGwpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xZihsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJmKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2YobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00Zihsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8vSSBndWVzcyB3ZSB3b24ndCBzdXBwb3J0IHNlcXVlbmNlPEdMZmxvYXQ+IC4uIHdoYXRldmVyIHRoYXQgaXMgPz9cblx0XG5cblx0Ly8vLy8gXG5cdFxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OZnYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBGbG9hdDMyQXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtZnZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIHZlYzJcblx0ICovXG5cdHNldFVuaWZvcm1mdjogZnVuY3Rpb24obmFtZSwgYXJyYXlCdWZmZXIsIGNvdW50KSB7XG5cdFx0J3VzZSBzdHJpY3QnO1xuXHRcdGNvdW50ID0gY291bnQgfHwgYXJyYXlCdWZmZXIubGVuZ3RoO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmIChsb2MgPT09IG51bGwpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChjb3VudCkge1xuXHRcdFx0Y2FzZSAxOiBnbC51bmlmb3JtMWZ2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMjogZ2wudW5pZm9ybTJmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDM6IGdsLnVuaWZvcm0zZnYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtNGZ2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIG1ldGhvZCB0byBzZXQgdW5pZm9ybU5pdiBmcm9tIHRoZSBnaXZlbiBBcnJheUJ1ZmZlci5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBcblx0ICogYnVmZmVyIChmb3IgMS00IGNvbXBvbmVudCB2ZWN0b3JzIHN0b3JlZCBpbiBhIGludCBhcnJheSkuIFRvIHVzZVxuXHQgKiB0aGlzIG1ldGhvZCB0byB1cGxvYWQgZGF0YSB0byB1bmlmb3JtIGFycmF5cywgeW91IG5lZWQgdG8gc3BlY2lmeSB0aGVcblx0ICogJ2NvdW50JyBwYXJhbWV0ZXI7IGkuZS4gdGhlIGRhdGEgdHlwZSB5b3UgYXJlIHVzaW5nIGZvciB0aGF0IGFycmF5LiBJZlxuXHQgKiBzcGVjaWZpZWQsIHRoaXMgd2lsbCBkaWN0YXRlIHdoZXRoZXIgdG8gY2FsbCB1bmlmb3JtMWZ2LCB1bmlmb3JtMmZ2LCBldGMuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldFVuaWZvcm1pdlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7QXJyYXlCdWZmZXJ9IGFycmF5QnVmZmVyIHRoZSBhcnJheSBidWZmZXJcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvdW50ICAgICAgICAgICAgb3B0aW9uYWwsIHRoZSBleHBsaWNpdCBkYXRhIHR5cGUgY291bnQsIGUuZy4gMiBmb3IgaXZlYzJcblx0ICovXG5cdHNldFVuaWZvcm1pdjogZnVuY3Rpb24obmFtZSwgYXJyYXlCdWZmZXIsIGNvdW50KSB7XG5cdFx0J3VzZSBzdHJpY3QnO1xuXHRcdGNvdW50ID0gY291bnQgfHwgYXJyYXlCdWZmZXIubGVuZ3RoO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmIChsb2MgPT09IG51bGwpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChjb3VudCkge1xuXHRcdFx0Y2FzZSAxOiBnbC51bmlmb3JtMWl2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMjogZ2wudW5pZm9ybTJpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDM6IGdsLnVuaWZvcm0zaXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtNGl2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgZnVuY3Rpb24gdG8gcGFzcyBhIE1hdHJpeDMgKGZyb20gdmVjbWF0aCxcblx0ICoga2FtaSdzIHByZWZlcnJlZCBtYXRoIGxpYnJhcnkpIG9yIGEgRmxvYXQzMkFycmF5IChlLmcuIGdsLW1hdHJpeClcblx0ICogdG8gYSBzaGFkZXIuIElmIG1hdCBpcyBhbiBvYmplY3Qgd2l0aCBcInZhbFwiLCBpdCBpcyBjb25zaWRlcmVkIHRvIGJlXG5cdCAqIGEgTWF0cml4Mywgb3RoZXJ3aXNlIGFzc3VtZWQgdG8gYmUgYSB0eXBlZCBhcnJheSBiZWluZyBwYXNzZWQgZGlyZWN0bHlcblx0ICogdG8gdGhlIHNoYWRlci5cblx0ICogXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWVcblx0ICogQHBhcmFtIHtNYXRyaXgzfEZsb2F0MzJBcnJheX0gbWF0IGEgTWF0cml4MyBvciBGbG9hdDMyQXJyYXlcblx0ICogQHBhcmFtIHtCb29sZWFufSB0cmFuc3Bvc2Ugd2hldGhlciB0byB0cmFuc3Bvc2UgdGhlIG1hdHJpeCwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0c2V0VW5pZm9ybU1hdHJpeDM6IGZ1bmN0aW9uKG5hbWUsIG1hdCwgdHJhbnNwb3NlKSB7XG5cdFx0J3VzZSBzdHJpY3QnO1xuXHRcdHZhciBhcnIgPSB0eXBlb2YgbWF0ID09PSBcIm9iamVjdFwiICYmIG1hdC52YWwgPyBtYXQudmFsIDogbWF0O1xuXHRcdHRyYW5zcG9zZSA9ICEhdHJhbnNwb3NlOyAvL3RvIGJvb2xlYW5cblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmIChsb2MgPT09IG51bGwpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0Z2wudW5pZm9ybU1hdHJpeDNmdihsb2MsIHRyYW5zcG9zZSwgYXJyKVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgZnVuY3Rpb24gdG8gcGFzcyBhIE1hdHJpeDQgKGZyb20gdmVjbWF0aCxcblx0ICoga2FtaSdzIHByZWZlcnJlZCBtYXRoIGxpYnJhcnkpIG9yIGEgRmxvYXQzMkFycmF5IChlLmcuIGdsLW1hdHJpeClcblx0ICogdG8gYSBzaGFkZXIuIElmIG1hdCBpcyBhbiBvYmplY3Qgd2l0aCBcInZhbFwiLCBpdCBpcyBjb25zaWRlcmVkIHRvIGJlXG5cdCAqIGEgTWF0cml4NCwgb3RoZXJ3aXNlIGFzc3VtZWQgdG8gYmUgYSB0eXBlZCBhcnJheSBiZWluZyBwYXNzZWQgZGlyZWN0bHlcblx0ICogdG8gdGhlIHNoYWRlci5cblx0ICogXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWVcblx0ICogQHBhcmFtIHtNYXRyaXg0fEZsb2F0MzJBcnJheX0gbWF0IGEgTWF0cml4NCBvciBGbG9hdDMyQXJyYXlcblx0ICogQHBhcmFtIHtCb29sZWFufSB0cmFuc3Bvc2Ugd2hldGhlciB0byB0cmFuc3Bvc2UgdGhlIG1hdHJpeCwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0c2V0VW5pZm9ybU1hdHJpeDQ6IGZ1bmN0aW9uKG5hbWUsIG1hdCwgdHJhbnNwb3NlKSB7XG5cdFx0J3VzZSBzdHJpY3QnO1xuXHRcdHZhciBhcnIgPSB0eXBlb2YgbWF0ID09PSBcIm9iamVjdFwiICYmIG1hdC52YWwgPyBtYXQudmFsIDogbWF0O1xuXHRcdHRyYW5zcG9zZSA9ICEhdHJhbnNwb3NlOyAvL3RvIGJvb2xlYW5cblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmIChsb2MgPT09IG51bGwpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0Z2wudW5pZm9ybU1hdHJpeDRmdihsb2MsIHRyYW5zcG9zZSwgYXJyKVxuXHR9IFxuIFxufSk7XG5cbi8vU29tZSBkZWZhdWx0IGF0dHJpYnV0ZSBuYW1lcyB0aGF0IHBhcnRzIG9mIGthbWkgd2lsbCB1c2Vcbi8vd2hlbiBjcmVhdGluZyBhIHN0YW5kYXJkIHNoYWRlci5cblNoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFID0gXCJQb3NpdGlvblwiO1xuU2hhZGVyUHJvZ3JhbS5OT1JNQUxfQVRUUklCVVRFID0gXCJOb3JtYWxcIjtcblNoYWRlclByb2dyYW0uQ09MT1JfQVRUUklCVVRFID0gXCJDb2xvclwiO1xuU2hhZGVyUHJvZ3JhbS5URVhDT09SRF9BVFRSSUJVVEUgPSBcIlRleENvb3JkXCI7XG5cbm1vZHVsZS5leHBvcnRzID0gU2hhZGVyUHJvZ3JhbTsiLCIvKipcbiAgQXV0by1nZW5lcmF0ZWQgS2FtaSBpbmRleCBmaWxlLlxuICBDcmVhdGVkIG9uIDIwMTQtMDYtMTEuXG4qL1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgLy9jb3JlIGNsYXNzZXNcbiAgICAnQmFzZUJhdGNoJzogICAgICAgcmVxdWlyZSgnLi9CYXNlQmF0Y2guanMnKSxcbiAgICAnU3ByaXRlQmF0Y2gnOiAgICAgcmVxdWlyZSgnLi9TcHJpdGVCYXRjaC5qcycpLFxuICAgICdUZXh0dXJlJzogICAgICAgICByZXF1aXJlKCcuL1RleHR1cmUuanMnKSxcbiAgICAnVGV4dHVyZVJlZ2lvbic6ICAgcmVxdWlyZSgnLi9UZXh0dXJlUmVnaW9uLmpzJyksXG4gICAgJ1dlYkdMQ29udGV4dCc6ICAgIHJlcXVpcmUoJy4vV2ViR0xDb250ZXh0LmpzJyksXG4gICAgJ0ZyYW1lQnVmZmVyJzogICAgIHJlcXVpcmUoJy4vZ2x1dGlscy9GcmFtZUJ1ZmZlci5qcycpLFxuICAgICdNZXNoJzogICAgICAgICAgICByZXF1aXJlKCcuL2dsdXRpbHMvTWVzaC5qcycpLFxuICAgICdTaGFkZXJQcm9ncmFtJzogICByZXF1aXJlKCcuL2dsdXRpbHMvU2hhZGVyUHJvZ3JhbS5qcycpXG59OyIsInZhciBpbnQ4ID0gbmV3IEludDhBcnJheSg0KTtcbnZhciBpbnQzMiA9IG5ldyBJbnQzMkFycmF5KGludDguYnVmZmVyLCAwLCAxKTtcbnZhciBmbG9hdDMyID0gbmV3IEZsb2F0MzJBcnJheShpbnQ4LmJ1ZmZlciwgMCwgMSk7XG5cbi8qKlxuICogQSBzaW5nbGV0b24gZm9yIG51bWJlciB1dGlsaXRpZXMuIFxuICogQGNsYXNzIE51bWJlclV0aWxcbiAqL1xudmFyIE51bWJlclV0aWwgPSBmdW5jdGlvbigpIHtcblxufTtcblxuXG4vKipcbiAqIFJldHVybnMgYSBmbG9hdCByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gaW50IGJpdHMuIEFycmF5QnVmZmVyXG4gKiBpcyB1c2VkIGZvciB0aGUgY29udmVyc2lvbi5cbiAqXG4gKiBAbWV0aG9kICBpbnRCaXRzVG9GbG9hdFxuICogQHN0YXRpY1xuICogQHBhcmFtICB7TnVtYmVyfSBpIHRoZSBpbnQgdG8gY2FzdFxuICogQHJldHVybiB7TnVtYmVyfSAgIHRoZSBmbG9hdFxuICovXG5OdW1iZXJVdGlsLmludEJpdHNUb0Zsb2F0ID0gZnVuY3Rpb24oaSkge1xuXHRpbnQzMlswXSA9IGk7XG5cdHJldHVybiBmbG9hdDMyWzBdO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnQgYml0cyBmcm9tIHRoZSBnaXZlbiBmbG9hdC4gQXJyYXlCdWZmZXIgaXMgdXNlZFxuICogZm9yIHRoZSBjb252ZXJzaW9uLlxuICpcbiAqIEBtZXRob2QgIGZsb2F0VG9JbnRCaXRzXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IGYgdGhlIGZsb2F0IHRvIGNhc3RcbiAqIEByZXR1cm4ge051bWJlcn0gICB0aGUgaW50IGJpdHNcbiAqL1xuTnVtYmVyVXRpbC5mbG9hdFRvSW50Qml0cyA9IGZ1bmN0aW9uKGYpIHtcblx0ZmxvYXQzMlswXSA9IGY7XG5cdHJldHVybiBpbnQzMlswXTtcbn07XG5cbi8qKlxuICogRW5jb2RlcyBBQkdSIGludCBhcyBhIGZsb2F0LCB3aXRoIHNsaWdodCBwcmVjaXNpb24gbG9zcy5cbiAqXG4gKiBAbWV0aG9kICBpbnRUb0Zsb2F0Q29sb3JcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TnVtYmVyfSB2YWx1ZSBhbiBBQkdSIHBhY2tlZCBpbnRlZ2VyXG4gKi9cbk51bWJlclV0aWwuaW50VG9GbG9hdENvbG9yID0gZnVuY3Rpb24odmFsdWUpIHtcblx0cmV0dXJuIE51bWJlclV0aWwuaW50Qml0c1RvRmxvYXQoIHZhbHVlICYgMHhmZWZmZmZmZiApO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGEgZmxvYXQgZW5jb2RlZCBBQkdSIHZhbHVlIGZyb20gdGhlIGdpdmVuIFJHQkFcbiAqIGJ5dGVzICgwIC0gMjU1KS4gVXNlZnVsIGZvciBzYXZpbmcgYmFuZHdpZHRoIGluIHZlcnRleCBkYXRhLlxuICpcbiAqIEBtZXRob2QgIGNvbG9yVG9GbG9hdFxuICogQHN0YXRpY1xuICogQHBhcmFtIHtOdW1iZXJ9IHIgdGhlIFJlZCBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGcgdGhlIEdyZWVuIGJ5dGUgKDAgLSAyNTUpXG4gKiBAcGFyYW0ge051bWJlcn0gYiB0aGUgQmx1ZSBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGEgdGhlIEFscGhhIGJ5dGUgKDAgLSAyNTUpXG4gKiBAcmV0dXJuIHtGbG9hdDMyfSAgYSBGbG9hdDMyIG9mIHRoZSBSR0JBIGNvbG9yXG4gKi9cbk51bWJlclV0aWwuY29sb3JUb0Zsb2F0ID0gZnVuY3Rpb24ociwgZywgYiwgYSkge1xuXHR2YXIgYml0cyA9IChhIDw8IDI0IHwgYiA8PCAxNiB8IGcgPDwgOCB8IHIpO1xuXHRyZXR1cm4gTnVtYmVyVXRpbC5pbnRUb0Zsb2F0Q29sb3IoYml0cyk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgbnVtYmVyIGlzIGEgcG93ZXItb2YtdHdvLlxuICpcbiAqIEBtZXRob2QgIGlzUG93ZXJPZlR3b1xuICogQHBhcmFtICB7TnVtYmVyfSAgbiB0aGUgbnVtYmVyIHRvIHRlc3RcbiAqIEByZXR1cm4ge0Jvb2xlYW59ICAgdHJ1ZSBpZiBwb3dlci1vZi10d29cbiAqL1xuTnVtYmVyVXRpbC5pc1Bvd2VyT2ZUd28gPSBmdW5jdGlvbihuKSB7XG5cdHJldHVybiAobiAmIChuIC0gMSkpID09PSAwO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXItb2YtdHdvIGZyb20gdGhlIHNwZWNpZmllZCBudW1iZXIuIFxuICogXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiB0d29cbiAqL1xuTnVtYmVyVXRpbC5uZXh0UG93ZXJPZlR3byA9IGZ1bmN0aW9uKG4pIHtcblx0bi0tO1xuXHRuIHw9IG4gPj4gMTtcblx0biB8PSBuID4+IDI7XG5cdG4gfD0gbiA+PiA0O1xuXHRuIHw9IG4gPj4gODtcblx0biB8PSBuID4+IDE2O1xuXHRyZXR1cm4gbisxO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOdW1iZXJVdGlsOyIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwiZnVuY3Rpb24gaGFzR2V0dGVyT3JTZXR0ZXIoZGVmKSB7XG5cdHJldHVybiAoISFkZWYuZ2V0ICYmIHR5cGVvZiBkZWYuZ2V0ID09PSBcImZ1bmN0aW9uXCIpIHx8ICghIWRlZi5zZXQgJiYgdHlwZW9mIGRlZi5zZXQgPT09IFwiZnVuY3Rpb25cIik7XG59XG5cbmZ1bmN0aW9uIGdldFByb3BlcnR5KGRlZmluaXRpb24sIGssIGlzQ2xhc3NEZXNjcmlwdG9yKSB7XG5cdC8vVGhpcyBtYXkgYmUgYSBsaWdodHdlaWdodCBvYmplY3QsIE9SIGl0IG1pZ2h0IGJlIGEgcHJvcGVydHlcblx0Ly90aGF0IHdhcyBkZWZpbmVkIHByZXZpb3VzbHkuXG5cdFxuXHQvL0ZvciBzaW1wbGUgY2xhc3MgZGVzY3JpcHRvcnMgd2UgY2FuIGp1c3QgYXNzdW1lIGl0cyBOT1QgcHJldmlvdXNseSBkZWZpbmVkLlxuXHR2YXIgZGVmID0gaXNDbGFzc0Rlc2NyaXB0b3IgXG5cdFx0XHRcdD8gZGVmaW5pdGlvbltrXSBcblx0XHRcdFx0OiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGRlZmluaXRpb24sIGspO1xuXG5cdGlmICghaXNDbGFzc0Rlc2NyaXB0b3IgJiYgZGVmLnZhbHVlICYmIHR5cGVvZiBkZWYudmFsdWUgPT09IFwib2JqZWN0XCIpIHtcblx0XHRkZWYgPSBkZWYudmFsdWU7XG5cdH1cblxuXG5cdC8vVGhpcyBtaWdodCBiZSBhIHJlZ3VsYXIgcHJvcGVydHksIG9yIGl0IG1heSBiZSBhIGdldHRlci9zZXR0ZXIgdGhlIHVzZXIgZGVmaW5lZCBpbiBhIGNsYXNzLlxuXHRpZiAoIGRlZiAmJiBoYXNHZXR0ZXJPclNldHRlcihkZWYpICkge1xuXHRcdGlmICh0eXBlb2YgZGVmLmVudW1lcmFibGUgPT09IFwidW5kZWZpbmVkXCIpXG5cdFx0XHRkZWYuZW51bWVyYWJsZSA9IHRydWU7XG5cdFx0aWYgKHR5cGVvZiBkZWYuY29uZmlndXJhYmxlID09PSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0ZGVmLmNvbmZpZ3VyYWJsZSA9IHRydWU7XG5cdFx0cmV0dXJuIGRlZjtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZnVuY3Rpb24gaGFzTm9uQ29uZmlndXJhYmxlKG9iaiwgaykge1xuXHR2YXIgcHJvcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqLCBrKTtcblx0aWYgKCFwcm9wKVxuXHRcdHJldHVybiBmYWxzZTtcblxuXHRpZiAocHJvcC52YWx1ZSAmJiB0eXBlb2YgcHJvcC52YWx1ZSA9PT0gXCJvYmplY3RcIilcblx0XHRwcm9wID0gcHJvcC52YWx1ZTtcblxuXHRpZiAocHJvcC5jb25maWd1cmFibGUgPT09IGZhbHNlKSBcblx0XHRyZXR1cm4gdHJ1ZTtcblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbi8vVE9ETzogT24gY3JlYXRlLCBcbi8vXHRcdE9uIG1peGluLCBcblxuZnVuY3Rpb24gZXh0ZW5kKGN0b3IsIGRlZmluaXRpb24sIGlzQ2xhc3NEZXNjcmlwdG9yLCBleHRlbmQpIHtcblx0Zm9yICh2YXIgayBpbiBkZWZpbml0aW9uKSB7XG5cdFx0aWYgKCFkZWZpbml0aW9uLmhhc093blByb3BlcnR5KGspKVxuXHRcdFx0Y29udGludWU7XG5cblx0XHR2YXIgZGVmID0gZ2V0UHJvcGVydHkoZGVmaW5pdGlvbiwgaywgaXNDbGFzc0Rlc2NyaXB0b3IpO1xuXG5cdFx0aWYgKGRlZiAhPT0gZmFsc2UpIHtcblx0XHRcdC8vSWYgRXh0ZW5kcyBpcyB1c2VkLCB3ZSB3aWxsIGNoZWNrIGl0cyBwcm90b3R5cGUgdG8gc2VlIGlmIFxuXHRcdFx0Ly90aGUgZmluYWwgdmFyaWFibGUgZXhpc3RzLlxuXHRcdFx0XG5cdFx0XHR2YXIgcGFyZW50ID0gZXh0ZW5kIHx8IGN0b3I7XG5cdFx0XHRpZiAoaGFzTm9uQ29uZmlndXJhYmxlKHBhcmVudC5wcm90b3R5cGUsIGspKSB7XG5cblx0XHRcdFx0Ly9qdXN0IHNraXAgdGhlIGZpbmFsIHByb3BlcnR5XG5cdFx0XHRcdGlmIChDbGFzcy5pZ25vcmVGaW5hbHMpXG5cdFx0XHRcdFx0Y29udGludWU7XG5cblx0XHRcdFx0Ly9XZSBjYW5ub3QgcmUtZGVmaW5lIGEgcHJvcGVydHkgdGhhdCBpcyBjb25maWd1cmFibGU9ZmFsc2UuXG5cdFx0XHRcdC8vU28gd2Ugd2lsbCBjb25zaWRlciB0aGVtIGZpbmFsIGFuZCB0aHJvdyBhbiBlcnJvci4gVGhpcyBpcyBieVxuXHRcdFx0XHQvL2RlZmF1bHQgc28gaXQgaXMgY2xlYXIgdG8gdGhlIGRldmVsb3BlciB3aGF0IGlzIGhhcHBlbmluZy5cblx0XHRcdFx0Ly9Zb3UgY2FuIHNldCBpZ25vcmVGaW5hbHMgdG8gdHJ1ZSBpZiB5b3UgbmVlZCB0byBleHRlbmQgYSBjbGFzc1xuXHRcdFx0XHQvL3doaWNoIGhhcyBjb25maWd1cmFibGU9ZmFsc2U7IGl0IHdpbGwgc2ltcGx5IG5vdCByZS1kZWZpbmUgZmluYWwgcHJvcGVydGllcy5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IG92ZXJyaWRlIGZpbmFsIHByb3BlcnR5ICdcIitrXG5cdFx0XHRcdFx0XHRcdCtcIicsIHNldCBDbGFzcy5pZ25vcmVGaW5hbHMgPSB0cnVlIHRvIHNraXBcIik7XG5cdFx0XHR9XG5cblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjdG9yLnByb3RvdHlwZSwgaywgZGVmKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3Rvci5wcm90b3R5cGVba10gPSBkZWZpbml0aW9uW2tdO1xuXHRcdH1cblxuXHR9XG59XG5cbi8qKlxuICovXG5mdW5jdGlvbiBtaXhpbihteUNsYXNzLCBtaXhpbnMpIHtcblx0aWYgKCFtaXhpbnMpXG5cdFx0cmV0dXJuO1xuXG5cdGlmICghQXJyYXkuaXNBcnJheShtaXhpbnMpKVxuXHRcdG1peGlucyA9IFttaXhpbnNdO1xuXG5cdGZvciAodmFyIGk9MDsgaTxtaXhpbnMubGVuZ3RoOyBpKyspIHtcblx0XHRleHRlbmQobXlDbGFzcywgbWl4aW5zW2ldLnByb3RvdHlwZSB8fCBtaXhpbnNbaV0pO1xuXHR9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBjbGFzcyB3aXRoIHRoZSBnaXZlbiBkZXNjcmlwdG9yLlxuICogVGhlIGNvbnN0cnVjdG9yLCBkZWZpbmVkIGJ5IHRoZSBuYW1lIGBpbml0aWFsaXplYCxcbiAqIGlzIGFuIG9wdGlvbmFsIGZ1bmN0aW9uLiBJZiB1bnNwZWNpZmllZCwgYW4gYW5vbnltb3VzXG4gKiBmdW5jdGlvbiB3aWxsIGJlIHVzZWQgd2hpY2ggY2FsbHMgdGhlIHBhcmVudCBjbGFzcyAoaWZcbiAqIG9uZSBleGlzdHMpLiBcbiAqXG4gKiBZb3UgY2FuIGFsc28gdXNlIGBFeHRlbmRzYCBhbmQgYE1peGluc2AgdG8gcHJvdmlkZSBzdWJjbGFzc2luZ1xuICogYW5kIGluaGVyaXRhbmNlLlxuICpcbiAqIEBjbGFzcyAgQ2xhc3NcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IGRlZmluaXRpb24gYSBkaWN0aW9uYXJ5IG9mIGZ1bmN0aW9ucyBmb3IgdGhlIGNsYXNzXG4gKiBAZXhhbXBsZVxuICpcbiAqIFx0XHR2YXIgTXlDbGFzcyA9IG5ldyBDbGFzcyh7XG4gKiBcdFx0XG4gKiBcdFx0XHRpbml0aWFsaXplOiBmdW5jdGlvbigpIHtcbiAqIFx0XHRcdFx0dGhpcy5mb28gPSAyLjA7XG4gKiBcdFx0XHR9LFxuICpcbiAqIFx0XHRcdGJhcjogZnVuY3Rpb24oKSB7XG4gKiBcdFx0XHRcdHJldHVybiB0aGlzLmZvbyArIDU7XG4gKiBcdFx0XHR9XG4gKiBcdFx0fSk7XG4gKi9cbmZ1bmN0aW9uIENsYXNzKGRlZmluaXRpb24pIHtcblx0aWYgKCFkZWZpbml0aW9uKVxuXHRcdGRlZmluaXRpb24gPSB7fTtcblxuXHQvL1RoZSB2YXJpYWJsZSBuYW1lIGhlcmUgZGljdGF0ZXMgd2hhdCB3ZSBzZWUgaW4gQ2hyb21lIGRlYnVnZ2VyXG5cdHZhciBpbml0aWFsaXplO1xuXHR2YXIgRXh0ZW5kcztcblxuXHRpZiAoZGVmaW5pdGlvbi5pbml0aWFsaXplKSB7XG5cdFx0aWYgKHR5cGVvZiBkZWZpbml0aW9uLmluaXRpYWxpemUgIT09IFwiZnVuY3Rpb25cIilcblx0XHRcdHRocm93IG5ldyBFcnJvcihcImluaXRpYWxpemUgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXHRcdGluaXRpYWxpemUgPSBkZWZpbml0aW9uLmluaXRpYWxpemU7XG5cblx0XHQvL1VzdWFsbHkgd2Ugc2hvdWxkIGF2b2lkIFwiZGVsZXRlXCIgaW4gVjggYXQgYWxsIGNvc3RzLlxuXHRcdC8vSG93ZXZlciwgaXRzIHVubGlrZWx5IHRvIG1ha2UgYW55IHBlcmZvcm1hbmNlIGRpZmZlcmVuY2Vcblx0XHQvL2hlcmUgc2luY2Ugd2Ugb25seSBjYWxsIHRoaXMgb24gY2xhc3MgY3JlYXRpb24gKGkuZS4gbm90IG9iamVjdCBjcmVhdGlvbikuXG5cdFx0ZGVsZXRlIGRlZmluaXRpb24uaW5pdGlhbGl6ZTtcblx0fSBlbHNlIHtcblx0XHRpZiAoZGVmaW5pdGlvbi5FeHRlbmRzKSB7XG5cdFx0XHR2YXIgYmFzZSA9IGRlZmluaXRpb24uRXh0ZW5kcztcblx0XHRcdGluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGJhc2UuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblx0XHRcdH07IFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpbml0aWFsaXplID0gZnVuY3Rpb24gKCkge307IFxuXHRcdH1cblx0fVxuXG5cdGlmIChkZWZpbml0aW9uLkV4dGVuZHMpIHtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoZGVmaW5pdGlvbi5FeHRlbmRzLnByb3RvdHlwZSk7XG5cdFx0aW5pdGlhbGl6ZS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBpbml0aWFsaXplO1xuXHRcdC8vZm9yIGdldE93blByb3BlcnR5RGVzY3JpcHRvciB0byB3b3JrLCB3ZSBuZWVkIHRvIGFjdFxuXHRcdC8vZGlyZWN0bHkgb24gdGhlIEV4dGVuZHMgKG9yIE1peGluKVxuXHRcdEV4dGVuZHMgPSBkZWZpbml0aW9uLkV4dGVuZHM7XG5cdFx0ZGVsZXRlIGRlZmluaXRpb24uRXh0ZW5kcztcblx0fSBlbHNlIHtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGluaXRpYWxpemU7XG5cdH1cblxuXHQvL0dyYWIgdGhlIG1peGlucywgaWYgdGhleSBhcmUgc3BlY2lmaWVkLi4uXG5cdHZhciBtaXhpbnMgPSBudWxsO1xuXHRpZiAoZGVmaW5pdGlvbi5NaXhpbnMpIHtcblx0XHRtaXhpbnMgPSBkZWZpbml0aW9uLk1peGlucztcblx0XHRkZWxldGUgZGVmaW5pdGlvbi5NaXhpbnM7XG5cdH1cblxuXHQvL0ZpcnN0LCBtaXhpbiBpZiB3ZSBjYW4uXG5cdG1peGluKGluaXRpYWxpemUsIG1peGlucyk7XG5cblx0Ly9Ob3cgd2UgZ3JhYiB0aGUgYWN0dWFsIGRlZmluaXRpb24gd2hpY2ggZGVmaW5lcyB0aGUgb3ZlcnJpZGVzLlxuXHRleHRlbmQoaW5pdGlhbGl6ZSwgZGVmaW5pdGlvbiwgdHJ1ZSwgRXh0ZW5kcyk7XG5cblx0cmV0dXJuIGluaXRpYWxpemU7XG59O1xuXG5DbGFzcy5leHRlbmQgPSBleHRlbmQ7XG5DbGFzcy5taXhpbiA9IG1peGluO1xuQ2xhc3MuaWdub3JlRmluYWxzID0gZmFsc2U7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xhc3M7IiwiLypcbiAqIHJhZi5qc1xuICogaHR0cHM6Ly9naXRodWIuY29tL25ncnltYW4vcmFmLmpzXG4gKlxuICogb3JpZ2luYWwgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHBvbHlmaWxsIGJ5IEVyaWsgTcO2bGxlclxuICogaW5zcGlyZWQgZnJvbSBwYXVsX2lyaXNoIGdpc3QgYW5kIHBvc3RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgbmdyeW1hblxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG5cbihmdW5jdGlvbih3aW5kb3cpIHtcblx0dmFyIGxhc3RUaW1lID0gMCxcblx0XHR2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J10sXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSxcblx0XHRpID0gdmVuZG9ycy5sZW5ndGg7XG5cblx0Ly8gdHJ5IHRvIHVuLXByZWZpeCBleGlzdGluZyByYWZcblx0d2hpbGUgKC0taSA+PSAwICYmICFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ107XG5cdH1cblxuXHQvLyBwb2x5ZmlsbCB3aXRoIHNldFRpbWVvdXQgZmFsbGJhY2tcblx0Ly8gaGVhdmlseSBpbnNwaXJlZCBmcm9tIEBkYXJpdXMgZ2lzdCBtb2Q6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC8xNTc5NjcxI2NvbW1lbnQtODM3OTQ1XG5cdGlmICghcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICFjYW5jZWxBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbm93ID0gRGF0ZS5ub3coKSwgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xuXHRcdFx0cmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpO1xuXHRcdFx0fSwgbmV4dFRpbWUgLSBub3cpO1xuXHRcdH07XG5cblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcblx0fVxuXG5cdC8vIGV4cG9ydCB0byB3aW5kb3dcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZTtcblx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG59KHdpbmRvdykpOyIsIi8vU2luY2UgYm90aCBicmZzIGFuZCBzY3JpcHQtdGFnIGRlbW9zIHVzZSB0aGUgc2FtZVxuLy9zb3VyY2UsIHdlIGNhbiBqdXN0IGRlZmluZSBpdCBoZXJlIGFuZCByZXF1aXJlIGl0XG5cbi8vaW5jbHVkZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgcG9seWZpbGxcbnJlcXVpcmUoJ3JhZi5qcycpO1xuXG4vL2thbWkgaW5jbHVkZXNcbnZhciBXZWJHTENvbnRleHQgID0gcmVxdWlyZSgna2FtaScpLldlYkdMQ29udGV4dDtcbnZhciBUZXh0dXJlICAgICAgID0gcmVxdWlyZSgna2FtaScpLlRleHR1cmU7XG52YXIgU3ByaXRlQmF0Y2ggICA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDtcbnZhciBTaGFkZXJQcm9ncmFtID0gcmVxdWlyZSgna2FtaScpLlNoYWRlclByb2dyYW07XG5cbi8vVGhpcyBzaG91bGQgb25seSBiZSBjYWxsZWQgb25jZSBET00gaGFzIGJlZW4gbG9hZGVkXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZlcnRTcmMsIGZyYWdTcmMpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICBcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNhbnZhcyk7ICAgIFxuICAgIFxuICAgIGNhbnZhcy53aWR0aCA9IDE1MDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gMTUwO1xuXG4gICAgdmFyIGNvbnRleHQgPSBuZXcgV2ViR0xDb250ZXh0KGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCwgY2FudmFzKTtcblxuICAgIC8vd2Ugd2lsbCB1c2UgU3ByaXRlQmF0Y2ggZm9yIHNpbXBsZSBxdWFkIHJlbmRlcmluZ1xuICAgIHZhciBiYXRjaCA9IG5ldyBTcHJpdGVCYXRjaChjb250ZXh0KTsgICBcblxuICAgIC8vc2luY2Ugd2UgYXJlIHVzaW5nIFNwcml0ZUJhdGNoLCBpdCBleHBlY3RzIGEgdGV4dHVyZVxuICAgIC8vaW4gb3VyIGNhc2Ugd2UnbGwganVzdCB1c2UgYW4gZW1wdHkgdHJhbnNwYXJlbnQgMXgxIHRleHR1cmUuXG4gICAgLy9PdXIgc2hhZGVyIHdpbGwgZG8gYWxsIHRoZSBwaXhlbCBkcmF3aW5nLlxuICAgIHZhciB0ZXgwID0gbmV3IFRleHR1cmUoY29udGV4dCwgMSwgMSk7XG5cbiAgICB2YXIgbW91c2VYID0gMCwgXG4gICAgICAgIG1vdXNlWSA9IDAsXG4gICAgICAgIHRpbWUgPSAwO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgZnVuY3Rpb24oZXYpIHtcbiAgICAgICAgbW91c2VYID0gZXYucGFnZVggLyBjYW52YXMud2lkdGg7XG4gICAgICAgIG1vdXNlWSA9IDEuMCAtIGV2LnBhZ2VZIC8gY2FudmFzLmhlaWdodDtcbiAgICB9LCB0cnVlKTtcblxuICAgIHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbShjb250ZXh0LCB2ZXJ0U3JjLCBmcmFnU3JjKTtcblxuICAgIC8vc29tZXRpbWVzIHRoZSBzaGFkZXIgZ2l2ZXMgdXMgdXNlZnVsIHdhcm5pbmdzLCBldmVuIGlmIGl0IGNvbXBpbGVkIHN1Y2Nlc3NmdWxseVxuICAgIGlmIChzaGFkZXIubG9nKSBcbiAgICAgICAgY29uc29sZS53YXJuKHNoYWRlci5sb2cpO1xuXG5cblxuICAgIGZ1bmN0aW9uIHJlbmRlcigpIHtcbiAgICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlcik7XG4gICAgICAgIGJhdGNoLnNoYWRlciA9IHNoYWRlcjtcblxuICAgICAgICBiYXRjaC5iZWdpbigpO1xuICAgICAgICBzaGFkZXIuc2V0VW5pZm9ybWYoXCJ0aW1lXCIsIHRpbWUrPTAuMDEpOyBcbiAgICAgICAgc2hhZGVyLnNldFVuaWZvcm1mKFwibW91c2VcIiwgbW91c2VYLCBtb3VzZVkpOyBcblxuICAgICAgICBiYXRjaC5kcmF3KHRleDAsIDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7ICAgICAgICBcblxuICAgICAgICBiYXRjaC5lbmQoKTtcbiAgICB9ICAgXG5cbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcbn0iLCJ2YXIgZG9tcmVhZHkgPSByZXF1aXJlKCdkb21yZWFkeScpO1xudmFyIGJhc2UgPSByZXF1aXJlKCcuLi9iYXNlJyk7XG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xuXG5kb21yZWFkeShmdW5jdGlvbigpIHtcbiAgICAvL0hlcmUgaXMgd2hlcmUgd2UgcXVlcnkgdGhlIEdMU0wgc291cmNlXG4gICAgLy9XZSB1c2UgYSBicm93c2VyaWZ5IHRyYW5zZm9ybSB0byBkZWNvdXBsZSB0aGVtIGZyb20gb3VyIEpTL0hUTUwgc291cmNlIGNvZGVcbiAgICAvL0J1dCB0aGUgYnVpbGQgc3RlcCB3aWxsIGlubGluZSB0aGVtIGludG8gb3VyIEpTLCBzbyB0aGVyZSBhcmUgbm8gZXh0cmEgSFRUUCByZXF1ZXN0c1xuICAgIHZhciB2ZXJ0ID0gXCIvL2luY29taW5nIFBvc2l0aW9uIGF0dHJpYnV0ZSBmcm9tIG91ciBTcHJpdGVCYXRjaFxcbmF0dHJpYnV0ZSB2ZWMyIFBvc2l0aW9uO1xcbmF0dHJpYnV0ZSB2ZWM0IENvbG9yO1xcbmF0dHJpYnV0ZSB2ZWMyIFRleENvb3JkMDtcXG51bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1xcbnZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1xcbnZhcnlpbmcgdmVjNCB2Q29sb3I7XFxuXFxudm9pZCBtYWluKHZvaWQpIHtcXG4gICBnbF9Qb3NpdGlvbiA9IHZlYzQoIFBvc2l0aW9uLnggLyB1X3Byb2plY3Rpb24ueCAtIDEuMCwgUG9zaXRpb24ueSAvIC11X3Byb2plY3Rpb24ueSArIDEuMCAsIDAuMCwgMS4wKTtcXG4gICB2VGV4Q29vcmQwID0gVGV4Q29vcmQwO1xcbiAgIHZDb2xvciA9IENvbG9yO1xcbn0gXCJcbiAgICB2YXIgZnJhZyA9IFwiI2lmZGVmIEdMX0VTXFxucHJlY2lzaW9uIG1lZGl1bXAgZmxvYXQ7XFxuI2VuZGlmXFxuXFxuLyoqXFxuICogVGhpcyBpcyBhIGhvcnJpYmx5IHVub3B0aW1pemVkIHRlY2ggZGVtbyBvZiBzb21lIHNwb3RsaWdodCBlZmZlY3RzXFxuICogaW4gYSBmcmFnbWVudCBzaGFkZXIuIDopIFxcbiAqXFxuICogYnkgbWF0dGRlc2wgXFxuICovXFxuXFxudW5pZm9ybSBmbG9hdCB0aW1lO1xcbnVuaWZvcm0gdmVjMiBtb3VzZTtcXG5cXG52YXJ5aW5nIHZlYzIgdlRleENvb3JkMDtcXG52YXJ5aW5nIHZlYzQgdkNvbG9yO1xcblxcbiNkZWZpbmUgUEkgMy4xNDE2XFxuXFxudm9pZCBtYWluKHZvaWQpXFxue1xcblxcdHZlYzIgcCA9IHZlYzIodlRleENvb3JkMC54LCAxLjAtdlRleENvb3JkMC55KTtcXG5cXHRwLnggKz0gMC41ODtcXG5cXHRwLnkgLT0gMC42MTtcXG5cXHR2ZWMyIGNlbnRlciA9IHZlYzIoMC41LCAwLjUpO1xcblxcdGZsb2F0IGQgPSBkaXN0YW5jZShwLCBjZW50ZXIpO1xcblxcdFxcdFxcblxcdC8vYmx1aXNoIHRpbnQgZnJvbSB0b3AgbGVmdFxcblxcdHZlYzMgY29sb3IgPSB2ZWMzKDEuMC1kKjAuNzUpICogdmVjMygwLjMzLCAwLjM1LCAwLjUpO1xcblxcdFxcblxcdC8vYWRkIHNvbWUgZ3JlZW4gbmVhciBjZW50cmVcXG5cXHRjb2xvciArPSAoMS4wLWRpc3RhbmNlKHAsIHZlYzIoMS4wLCAwLjApKSoxLikqMC41ICogdmVjMygwLjM1LCAwLjY1LCAwLjQ1KTtcXG5cXHRcXG5cXHR2ZWMzIGxpZ2h0Q29sb3IgPSB2ZWMzKDAuMywgMC40NSwgMC42NSk7XFxuXFx0XFxuXFx0Zm9yIChpbnQgaT0wOyBpPDM7IGkrKykge1xcblxcdFxcdC8vZGlyZWN0aW9uIG9mIGxpZ2h0XFxuXFx0XFx0ZmxvYXQgenIgPSBzaW4odGltZSowLjE1KmZsb2F0KGkpKSowLjUgLSBQSS8zLjA7XFxuXFxuXFx0XFx0dmVjMyBkaXIgPSB2ZWMzKGNvcyh6ciksIHNpbih6ciksIDAuMCk7XFxuXFxuXFx0XFx0ZGlyLnggKz0gKChtb3VzZS54KjIuMC0xLjApKzEuMCkqZmxvYXQoMi1pKTtcXG5cXHRcXHRkaXIueSArPSAoKG1vdXNlLnkqMi4wLTEuMCktMS4wKSpmbG9hdCgyLWkpO1xcblxcdFxcdFxcblxcdFxcdHAueCAtPSAwLjAyO1xcblxcdFxcdFxcblxcdFxcdC8vbm9ybWFsaXplZCBzcG90bGlnaHQgdmVjdG9yXFxuXFx0XFx0dmVjMyBTcG90RGlyID0gbm9ybWFsaXplKGRpcik7XFxuXFx0XFx0XFxuXFx0XFx0Ly9cXG5cXHRcXHR2ZWMzIGF0dGVudWF0aW9uID0gdmVjMygwLjUsIDcuMCwgMTAuMCk7XFxuXFx0XFx0ZmxvYXQgc2hhZG93ID0gMS4wIC8gKGF0dGVudWF0aW9uLnggKyAoYXR0ZW51YXRpb24ueSpkKSArIChhdHRlbnVhdGlvbi56KmQqZCkpO1xcblxcblxcdFxcdHZlYzMgcG9zID0gdmVjMyhwLCAwLjApO1xcblxcdFxcdHZlYzMgZGVsdGEgPSBub3JtYWxpemUocG9zIC0gdmVjMyhjZW50ZXIsIDAuMCkpO1xcblxcdFxcdFxcblxcdFxcdGZsb2F0IGNvc091dGVyQ29uZSA9IGNvcyhyYWRpYW5zKDEuMCkpO1xcblxcdFxcdGZsb2F0IGNvc0lubmVyQ29uZSA9IGNvcyhyYWRpYW5zKDE1LjAgKyBmbG9hdChpKjIpKSk7XFxuXFx0XFx0ZmxvYXQgY29zRGlyZWN0aW9uID0gZG90KGRlbHRhLCBTcG90RGlyKTtcXG5cXHRcXHRcXG5cXHRcXHQvL2xpZ2h0Li4uXFxuXFx0XFx0Y29sb3IgKz0gc21vb3Roc3RlcChjb3NJbm5lckNvbmUsIGNvc091dGVyQ29uZSwgY29zRGlyZWN0aW9uKSAqIHNoYWRvdyAqIGxpZ2h0Q29sb3I7XFxuXFx0fVxcblxcdGNvbG9yICs9IHNpbih0aW1lKjAuNSkqMC4wNTtcXG5cXHRnbF9GcmFnQ29sb3IgPSB2ZWM0KHZlYzMoY29sb3IpLCAxLjApICogdkNvbG9yO1xcbn1cIlxuXG4gICAgLy9ydW4gdGhlIGJhc2UgZXhhbXBsZVxuICAgIGJhc2UodmVydCwgZnJhZyk7XG59KTsiXX0=
