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
var Texture = require('./Texture');

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
},{"./Texture":5,"klasse":14}],7:[function(require,module,exports){
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

		if (this.gl) {
			var gl = this.gl;
			gl.detachShader(this.vertShader);
			gl.detachShader(this.fragShader);

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
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		count = count || arrayBuffer.length;
		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
		var arr = typeof mat === "object" && mat.val ? mat.val : mat;
		transpose = !!transpose; //to boolean

		var gl = this.gl;
		var loc = this.getUniformLocation(name);
		if (!loc) 
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
  Created on 2014-03-02.
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

//Load the shockwave shader... It's a very simple one from here:
//http://www.geeks3d.com/20091116/shader-library-2d-shockwave-post-processing-filter-glsl/

//See here for other ripple shaders:
//http://adrianboeing.blogspot.com/2011/02/ripple-effect-in-webgl.html
//http://www.patriciogonzalezvivo.com/blog/?p=657
var vert = "//incoming Position attribute from our SpriteBatch\nattribute vec2 Position;\nattribute vec4 Color;\nattribute vec2 TexCoord0;\nuniform vec2 u_projection;\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\nvoid main(void) {\n   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);\n   vTexCoord0 = TexCoord0;\n   vColor = Color;\n}";
var frag = "#ifdef GL_ES\nprecision mediump float;\n#endif\n\nuniform sampler2D u_texture0;   // 0\nuniform vec2 center;      // Mouse position, normalized 0.0 to 1.0\nuniform float time;       // effect elapsed time\nuniform vec3 shockParams;\n\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\nvoid main() { \n    vec2 uv = vTexCoord0.xy;\n    vec2 texCoord = uv;\n    float dist = distance(uv, center);\n    if ( (dist <= (time + shockParams.z)) && (dist >= (time - shockParams.z)) ) \n    {\n        float diff = (dist - time); \n        float powDiff = 1.0 - pow(abs(diff*shockParams.x), shockParams.y); \n        float diffTime = diff  * powDiff; \n        vec2 diffUV = normalize(uv - center); \n        texCoord = uv + (diffUV * diffTime);\n    }\n    gl_FragColor = texture2D(u_texture0, texCoord) * vColor;\n}\n";

domready(function() {
    var canvas = document.createElement("canvas");
    var width = 500;
    var height = 500;

    canvas.width = width;
    canvas.height = height;
    
    document.body.appendChild(canvas);

    var text = document.createElement("span");
    text.style.position = "absolute";
    text.style.top = (height+10)+"px";
    text.style.left = "5px";
    text.innerHTML = "Click on the canvas to see the explosion effect"
    document.body.appendChild(text);

    //create our WebGL context
    var context = new WebGLContext(width, height, canvas);

    var batch = new SpriteBatch(context);
    
    var grassTex = new Texture(context, "img/grass.png");
    grassTex.setFilter(Texture.Filter.LINEAR);
    grassTex.setWrap(Texture.Wrap.REPEAT);

    var npcTex = new Texture(context, "img/guy.png");

    var fbo = new FrameBuffer(context, width, height);
    var fboTexRegion = new TextureRegion(fbo.texture);
    fboTexRegion.flip(false, true);

    var shockwaveShader = new ShaderProgram(context, vert, frag);
    if (shockwaveShader.log)
        console.warn(shockwaveShader.log);

    var mouseX = 0, 
        mouseY = 0,
        time = 1000,
        playerTime = 0;

    window.addEventListener("mousedown", function(ev) {
        time = 0;
        mouseX = ev.pageX / canvas.width;
        mouseY = 1.0 - ev.pageY / canvas.height;
    }, true);


    function render() {
        requestAnimationFrame(render);
        var gl = context.gl;

        //start rendering to off-screen texture
        fbo.begin();

        //clear the FBO tex
        gl.clear(gl.COLOR_BUFFER_BIT);

        batch.shader = batch.defaultShader;
        batch.resize(fbo.width, fbo.height);
        batch.begin();

        //tile it to the canvas
        //this only works with POT repeat-wrapped textures. i.e. no sprite sheets
        var nrepeats = 2;
        batch.draw(grassTex, 0, 0, width, height,
                    0, 0, nrepeats, nrepeats);
        
        //animate one of the player's movements...
        var anim = Math.sin(playerTime+=0.02) * 100;

        //draw some player sprites ...
        batch.draw(npcTex, 105, 50, npcTex.width*2, npcTex.height*2);
        batch.draw(npcTex, 255, 350, npcTex.width*2, npcTex.height*2);
        batch.draw(npcTex, 300+anim, 150, npcTex.width*2, npcTex.height*2);

        batch.end();

        //stop rendering to FBO, and start rendering to screen
        fbo.end();


        //clear the screen
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        batch.shader = shockwaveShader;
        batch.resize(fbo.width, fbo.height);
        batch.begin();

        shockwaveShader.setUniformf("shockParams", 10.0, 0.7, 0.1);
        shockwaveShader.setUniformf("center", mouseX, mouseY);
        shockwaveShader.setUniformf("time", time += 0.025);

        batch.drawRegion(fboTexRegion, 0, 0);
        batch.end();
    }

    requestAnimationFrame(render);
});
},{"domready":2,"fs":1,"kami":11,"raf.js":15}]},{},[16])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9fZW1wdHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvQmFzZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1Nwcml0ZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1RleHR1cmUuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvVGV4dHVyZVJlZ2lvbi5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9XZWJHTENvbnRleHQuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9GcmFtZUJ1ZmZlci5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL01lc2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9TaGFkZXJQcm9ncmFtLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbm9kZV9tb2R1bGVzL251bWJlci11dGlsL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbm9kZV9tb2R1bGVzL3NpZ25hbHMvZGlzdC9zaWduYWxzLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2tsYXNzZS9pbmRleC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9yYWYuanMvcmFmLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvc3JjL3Nob2Nrd2F2ZS9tYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNnQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcmNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNobUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6W251bGwsIi8qIVxuICAqIGRvbXJlYWR5IChjKSBEdXN0aW4gRGlheiAyMDEyIC0gTGljZW5zZSBNSVRcbiAgKi9cbiFmdW5jdGlvbiAobmFtZSwgZGVmaW5pdGlvbikge1xuICBpZiAodHlwZW9mIG1vZHVsZSAhPSAndW5kZWZpbmVkJykgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbml0aW9uKClcbiAgZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnKSBkZWZpbmUoZGVmaW5pdGlvbilcbiAgZWxzZSB0aGlzW25hbWVdID0gZGVmaW5pdGlvbigpXG59KCdkb21yZWFkeScsIGZ1bmN0aW9uIChyZWFkeSkge1xuXG4gIHZhciBmbnMgPSBbXSwgZm4sIGYgPSBmYWxzZVxuICAgICwgZG9jID0gZG9jdW1lbnRcbiAgICAsIHRlc3RFbCA9IGRvYy5kb2N1bWVudEVsZW1lbnRcbiAgICAsIGhhY2sgPSB0ZXN0RWwuZG9TY3JvbGxcbiAgICAsIGRvbUNvbnRlbnRMb2FkZWQgPSAnRE9NQ29udGVudExvYWRlZCdcbiAgICAsIGFkZEV2ZW50TGlzdGVuZXIgPSAnYWRkRXZlbnRMaXN0ZW5lcidcbiAgICAsIG9ucmVhZHlzdGF0ZWNoYW5nZSA9ICdvbnJlYWR5c3RhdGVjaGFuZ2UnXG4gICAgLCByZWFkeVN0YXRlID0gJ3JlYWR5U3RhdGUnXG4gICAgLCBsb2FkZWRSZ3ggPSBoYWNrID8gL15sb2FkZWR8XmMvIDogL15sb2FkZWR8Yy9cbiAgICAsIGxvYWRlZCA9IGxvYWRlZFJneC50ZXN0KGRvY1tyZWFkeVN0YXRlXSlcblxuICBmdW5jdGlvbiBmbHVzaChmKSB7XG4gICAgbG9hZGVkID0gMVxuICAgIHdoaWxlIChmID0gZm5zLnNoaWZ0KCkpIGYoKVxuICB9XG5cbiAgZG9jW2FkZEV2ZW50TGlzdGVuZXJdICYmIGRvY1thZGRFdmVudExpc3RlbmVyXShkb21Db250ZW50TG9hZGVkLCBmbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBkb2MucmVtb3ZlRXZlbnRMaXN0ZW5lcihkb21Db250ZW50TG9hZGVkLCBmbiwgZilcbiAgICBmbHVzaCgpXG4gIH0sIGYpXG5cblxuICBoYWNrICYmIGRvYy5hdHRhY2hFdmVudChvbnJlYWR5c3RhdGVjaGFuZ2UsIGZuID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICgvXmMvLnRlc3QoZG9jW3JlYWR5U3RhdGVdKSkge1xuICAgICAgZG9jLmRldGFjaEV2ZW50KG9ucmVhZHlzdGF0ZWNoYW5nZSwgZm4pXG4gICAgICBmbHVzaCgpXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiAocmVhZHkgPSBoYWNrID9cbiAgICBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIHNlbGYgIT0gdG9wID9cbiAgICAgICAgbG9hZGVkID8gZm4oKSA6IGZucy5wdXNoKGZuKSA6XG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGVzdEVsLmRvU2Nyb2xsKCdsZWZ0JylcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpIHsgcmVhZHkoZm4pIH0sIDUwKVxuICAgICAgICAgIH1cbiAgICAgICAgICBmbigpXG4gICAgICAgIH0oKVxuICAgIH0gOlxuICAgIGZ1bmN0aW9uIChmbikge1xuICAgICAgbG9hZGVkID8gZm4oKSA6IGZucy5wdXNoKGZuKVxuICAgIH0pXG59KVxuIiwiLyoqXG4gKiBUaGUgY29yZSBrYW1pIG1vZHVsZSBwcm92aWRlcyBiYXNpYyAyRCBzcHJpdGUgYmF0Y2hpbmcgYW5kIFxuICogYXNzZXQgbWFuYWdlbWVudC5cbiAqIFxuICogQG1vZHVsZSBrYW1pXG4gKi9cblxudmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgTWVzaCA9IHJlcXVpcmUoJy4vZ2x1dGlscy9NZXNoJyk7XG5cbnZhciBjb2xvclRvRmxvYXQgPSByZXF1aXJlKCdudW1iZXItdXRpbCcpLmNvbG9yVG9GbG9hdDtcblxuLyoqIFxuICogQSBiYXRjaGVyIG1peGluIGNvbXBvc2VkIG9mIHF1YWRzICh0d28gdHJpcywgaW5kZXhlZCkuIFxuICpcbiAqIFRoaXMgaXMgdXNlZCBpbnRlcm5hbGx5OyB1c2VycyBzaG91bGQgbG9vayBhdCBcbiAqIHt7I2Nyb3NzTGluayBcIlNwcml0ZUJhdGNoXCJ9fXt7L2Nyb3NzTGlua319IGluc3RlYWQsIHdoaWNoIGluaGVyaXRzIGZyb20gdGhpc1xuICogY2xhc3MuXG4gKiBcbiAqIFRoZSBiYXRjaGVyIGl0c2VsZiBpcyBub3QgbWFuYWdlZCBieSBXZWJHTENvbnRleHQ7IGhvd2V2ZXIsIGl0IG1ha2VzXG4gKiB1c2Ugb2YgTWVzaCBhbmQgVGV4dHVyZSB3aGljaCB3aWxsIGJlIG1hbmFnZWQuIEZvciB0aGlzIHJlYXNvbiwgdGhlIGJhdGNoZXJcbiAqIGRvZXMgbm90IGhvbGQgYSBkaXJlY3QgcmVmZXJlbmNlIHRvIHRoZSBHTCBzdGF0ZS5cbiAqXG4gKiBTdWJjbGFzc2VzIG11c3QgaW1wbGVtZW50IHRoZSBmb2xsb3dpbmc6ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9fY3JlYXRlU2hhZGVyOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiB7eyNjcm9zc0xpbmsgXCJCYXNlQmF0Y2gvX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXM6bWV0aG9kXCJ9fXt7L2Nyb3NzTGlua319ICBcbiAqIHt7I2Nyb3NzTGluayBcIkJhc2VCYXRjaC9nZXRWZXJ0ZXhTaXplOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiBcbiAqIEBjbGFzcyAgQmFzZUJhdGNoXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBjb250ZXh0IHRoaXMgYmF0Y2hlciBiZWxvbmdzIHRvXG4gKiBAcGFyYW0ge051bWJlcn0gc2l6ZSB0aGUgb3B0aW9uYWwgc2l6ZSBvZiB0aGlzIGJhdGNoLCBpLmUuIG1heCBudW1iZXIgb2YgcXVhZHNcbiAqIEBkZWZhdWx0ICA1MDBcbiAqL1xudmFyIEJhc2VCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9Db25zdHJ1Y3RvclxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBCYXNlQmF0Y2goY29udGV4dCwgc2l6ZSkge1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNwcml0ZUJhdGNoXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdHRoaXMuc2l6ZSA9IHNpemUgfHwgNTAwO1xuXHRcdFxuXHRcdC8vIDY1NTM1IGlzIG1heCBpbmRleCwgc28gNjU1MzUgLyA2ID0gMTA5MjIuXG5cdFx0aWYgKHRoaXMuc2l6ZSA+IDEwOTIyKSAgLy8oeW91J2QgaGF2ZSB0byBiZSBpbnNhbmUgdG8gdHJ5IGFuZCBiYXRjaCB0aGlzIG11Y2ggd2l0aCBXZWJHTClcblx0XHRcdHRocm93IFwiQ2FuJ3QgaGF2ZSBtb3JlIHRoYW4gMTA5MjIgc3ByaXRlcyBwZXIgYmF0Y2g6IFwiICsgdGhpcy5zaXplO1xuXHRcdFx0XHRcblx0XHRcblx0XHRcblx0XHR0aGlzLl9ibGVuZFNyYyA9IHRoaXMuY29udGV4dC5nbC5PTkU7XG5cdFx0dGhpcy5fYmxlbmREc3QgPSB0aGlzLmNvbnRleHQuZ2wuT05FX01JTlVTX1NSQ19BTFBIQVxuXHRcdHRoaXMuX2JsZW5kaW5nRW5hYmxlZCA9IHRydWU7XG5cdFx0dGhpcy5fc2hhZGVyID0gdGhpcy5fY3JlYXRlU2hhZGVyKCk7XG5cblx0XHQvKipcblx0XHQgKiBUaGlzIHNoYWRlciB3aWxsIGJlIHVzZWQgd2hlbmV2ZXIgXCJudWxsXCIgaXMgcGFzc2VkXG5cdFx0ICogYXMgdGhlIGJhdGNoJ3Mgc2hhZGVyLiBcblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7U2hhZGVyUHJvZ3JhbX0gc2hhZGVyXG5cdFx0ICovXG5cdFx0dGhpcy5kZWZhdWx0U2hhZGVyID0gdGhpcy5fc2hhZGVyO1xuXG5cdFx0LyoqXG5cdFx0ICogQnkgZGVmYXVsdCwgYSBTcHJpdGVCYXRjaCBpcyBjcmVhdGVkIHdpdGggaXRzIG93biBTaGFkZXJQcm9ncmFtLFxuXHRcdCAqIHN0b3JlZCBpbiBgZGVmYXVsdFNoYWRlcmAuIElmIHRoaXMgZmxhZyBpcyB0cnVlLCBvbiBkZWxldGluZyB0aGUgU3ByaXRlQmF0Y2gsIGl0c1xuXHRcdCAqIGBkZWZhdWx0U2hhZGVyYCB3aWxsIGFsc28gYmUgZGVsZXRlZC4gSWYgdGhpcyBmbGFnIGlzIGZhbHNlLCBubyBzaGFkZXJzXG5cdFx0ICogd2lsbCBiZSBkZWxldGVkIG9uIGRlc3Ryb3kuXG5cdFx0ICpcblx0XHQgKiBOb3RlIHRoYXQgaWYgeW91IHJlLWFzc2lnbiBgZGVmYXVsdFNoYWRlcmAsIHlvdSB3aWxsIG5lZWQgdG8gZGlzcG9zZSB0aGUgcHJldmlvdXNcblx0XHQgKiBkZWZhdWx0IHNoYWRlciB5b3Vyc2VsLiBcblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSBvd25zU2hhZGVyXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XG5cdFx0ICovXG5cdFx0dGhpcy5vd25zU2hhZGVyID0gdHJ1ZTtcblxuXHRcdHRoaXMuaWR4ID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgd2UgYXJlIGN1cnJlbnRseSBkcmF3aW5nIHRvIHRoZSBiYXRjaC4gRG8gbm90IG1vZGlmeS5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge0Jvb2xlYW59IGRyYXdpbmdcblx0XHQgKi9cblx0XHR0aGlzLmRyYXdpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMubWVzaCA9IHRoaXMuX2NyZWF0ZU1lc2godGhpcy5zaXplKTtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIEFCR1IgcGFja2VkIGNvbG9yLCBhcyBhIHNpbmdsZSBmbG9hdC4gVGhlIGRlZmF1bHRcblx0XHQgKiB2YWx1ZSBpcyB0aGUgY29sb3Igd2hpdGUgKDI1NSwgMjU1LCAyNTUsIDI1NSkuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gY29sb3Jcblx0XHQgKiBAcmVhZE9ubHkgXG5cdFx0ICovXG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yVG9GbG9hdCgyNTUsIDI1NSwgMjU1LCAyNTUpO1xuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdG8gcHJlbXVsdGlwbHkgYWxwaGEgb24gY2FsbHMgdG8gc2V0Q29sb3IuIFxuXHRcdCAqIFRoaXMgaXMgdHJ1ZSBieSBkZWZhdWx0LCBzbyB0aGF0IHdlIGNhbiBjb252ZW5pZW50bHkgd3JpdGU6XG5cdFx0ICpcblx0XHQgKiAgICAgYmF0Y2guc2V0Q29sb3IoMSwgMCwgMCwgMC4yNSk7IC8vdGludHMgcmVkIHdpdGggMjUlIG9wYWNpdHlcblx0XHQgKlxuXHRcdCAqIElmIGZhbHNlLCB5b3UgbXVzdCBwcmVtdWx0aXBseSB0aGUgY29sb3JzIHlvdXJzZWxmIHRvIGFjaGlldmVcblx0XHQgKiB0aGUgc2FtZSB0aW50LCBsaWtlIHNvOlxuXHRcdCAqXG5cdFx0ICogICAgIGJhdGNoLnNldENvbG9yKDAuMjUsIDAsIDAsIDAuMjUpO1xuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBwcmVtdWx0aXBsaWVkXG5cdFx0ICogQHR5cGUge0Jvb2xlYW59XG5cdFx0ICogQGRlZmF1bHQgIHRydWVcblx0XHQgKi9cblx0XHR0aGlzLnByZW11bHRpcGxpZWQgPSB0cnVlO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHByb3BlcnR5IHRvIGVuYWJsZSBvciBkaXNhYmxlIGJsZW5kaW5nIGZvciB0aGlzIHNwcml0ZSBiYXRjaC4gSWZcblx0ICogd2UgYXJlIGN1cnJlbnRseSBkcmF3aW5nLCB0aGlzIHdpbGwgZmlyc3QgZmx1c2ggdGhlIGJhdGNoLCBhbmQgdGhlblxuXHQgKiB1cGRhdGUgR0xfQkxFTkQgc3RhdGUgKGVuYWJsZWQgb3IgZGlzYWJsZWQpIHdpdGggb3VyIG5ldyB2YWx1ZS5cblx0ICogXG5cdCAqIEBwcm9wZXJ0eSB7Qm9vbGVhbn0gYmxlbmRpbmdFbmFibGVkXG5cdCAqL1xuXHRibGVuZGluZ0VuYWJsZWQ6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dmFyIG9sZCA9IHRoaXMuX2JsZW5kaW5nRW5hYmxlZDtcblx0XHRcdGlmICh0aGlzLmRyYXdpbmcpXG5cdFx0XHRcdHRoaXMuZmx1c2goKTtcblxuXHRcdFx0dGhpcy5fYmxlbmRpbmdFbmFibGVkID0gdmFsO1xuXG5cdFx0XHQvL2lmIHdlIGhhdmUgYSBuZXcgdmFsdWUsIHVwZGF0ZSBpdC5cblx0XHRcdC8vdGhpcyBpcyBiZWNhdXNlIGJsZW5kIGlzIGRvbmUgaW4gYmVnaW4oKSAvIGVuZCgpIFxuXHRcdFx0aWYgKHRoaXMuZHJhd2luZyAmJiBvbGQgIT0gdmFsKSB7XG5cdFx0XHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcdFx0aWYgKHZhbClcblx0XHRcdFx0XHRnbC5lbmFibGUoZ2wuQkxFTkQpO1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0Z2wuZGlzYWJsZShnbC5CTEVORCk7XG5cdFx0XHR9XG5cblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZGluZ0VuYWJsZWQ7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBibGVuZCBzb3VyY2UgcGFyYW1ldGVycy4gXG5cdCAqIElmIHdlIGFyZSBjdXJyZW50bHkgZHJhd2luZywgdGhpcyB3aWxsIGZsdXNoIHRoZSBiYXRjaC5cblx0ICpcblx0ICogU2V0dGluZyBlaXRoZXIgc3JjIG9yIGRzdCB0byBgbnVsbGAgb3IgYSBmYWxzeSB2YWx1ZSB0ZWxscyB0aGUgU3ByaXRlQmF0Y2hcblx0ICogdG8gaWdub3JlIGdsLmJsZW5kRnVuYy4gVGhpcyBpcyB1c2VmdWwgaWYgeW91IHdpc2ggdG8gdXNlIHlvdXJcblx0ICogb3duIGJsZW5kRnVuYyBvciBibGVuZEZ1bmNTZXBhcmF0ZS4gXG5cdCAqIFxuXHQgKiBAcHJvcGVydHkge0dMZW51bX0gYmxlbmREc3QgXG5cdCAqL1xuXHRibGVuZFNyYzoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRpZiAodGhpcy5kcmF3aW5nKVxuXHRcdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLl9ibGVuZFNyYyA9IHZhbDtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZFNyYztcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGJsZW5kIGRlc3RpbmF0aW9uIHBhcmFtZXRlcnMuIFxuXHQgKiBJZiB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcsIHRoaXMgd2lsbCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIFNldHRpbmcgZWl0aGVyIHNyYyBvciBkc3QgdG8gYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgdGVsbHMgdGhlIFNwcml0ZUJhdGNoXG5cdCAqIHRvIGlnbm9yZSBnbC5ibGVuZEZ1bmMuIFRoaXMgaXMgdXNlZnVsIGlmIHlvdSB3aXNoIHRvIHVzZSB5b3VyXG5cdCAqIG93biBibGVuZEZ1bmMgb3IgYmxlbmRGdW5jU2VwYXJhdGUuIFxuXHQgKlxuXHQgKiBAcHJvcGVydHkge0dMZW51bX0gYmxlbmRTcmMgXG5cdCAqL1xuXHRibGVuZERzdDoge1xuXHRcdHNldDogZnVuY3Rpb24odmFsKSB7XG5cdFx0XHRpZiAodGhpcy5kcmF3aW5nKVxuXHRcdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLl9ibGVuZERzdCA9IHZhbDtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ibGVuZERzdDtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIGJsZW5kIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gcGFyYW1ldGVycy4gVGhpcyBpcyBcblx0ICogYSBjb252ZW5pZW5jZSBmdW5jdGlvbiBmb3IgdGhlIGJsZW5kU3JjIGFuZCBibGVuZERzdCBzZXR0ZXJzLlxuXHQgKiBJZiB3ZSBhcmUgY3VycmVudGx5IGRyYXdpbmcsIHRoaXMgd2lsbCBmbHVzaCB0aGUgYmF0Y2guXG5cdCAqXG5cdCAqIFNldHRpbmcgZWl0aGVyIHRvIGBudWxsYCBvciBhIGZhbHN5IHZhbHVlIHRlbGxzIHRoZSBTcHJpdGVCYXRjaFxuXHQgKiB0byBpZ25vcmUgZ2wuYmxlbmRGdW5jLiBUaGlzIGlzIHVzZWZ1bCBpZiB5b3Ugd2lzaCB0byB1c2UgeW91clxuXHQgKiBvd24gYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlLiBcblx0ICpcblx0ICogQG1ldGhvZCAgc2V0QmxlbmRGdW5jdGlvblxuXHQgKiBAcGFyYW0ge0dMZW51bX0gYmxlbmRTcmMgdGhlIHNvdXJjZSBibGVuZCBwYXJhbWV0ZXJcblx0ICogQHBhcmFtIHtHTGVudW19IGJsZW5kRHN0IHRoZSBkZXN0aW5hdGlvbiBibGVuZCBwYXJhbWV0ZXJcblx0ICovXG5cdHNldEJsZW5kRnVuY3Rpb246IGZ1bmN0aW9uKGJsZW5kU3JjLCBibGVuZERzdCkge1xuXHRcdHRoaXMuYmxlbmRTcmMgPSBibGVuZFNyYztcblx0XHR0aGlzLmJsZW5kRHN0ID0gYmxlbmREc3Q7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBzZXR0ZXIvZ2V0dGVyIGZvciB0aGlzIGJhdGNoJ3MgY3VycmVudCBTaGFkZXJQcm9ncmFtLlxuXHQgKiBJZiB0aGlzIGlzIHNldCB3aGVuIHRoZSBiYXRjaCBpcyBkcmF3aW5nLCB0aGUgc3RhdGUgd2lsbCBiZSBmbHVzaGVkXG5cdCAqIHRvIHRoZSBHUFUgYW5kIHRoZSBuZXcgc2hhZGVyIHdpbGwgdGhlbiBiZSBib3VuZC5cblx0ICpcblx0ICogSWYgYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgaXMgc3BlY2lmaWVkLCB0aGUgYmF0Y2gncyBgZGVmYXVsdFNoYWRlcmAgd2lsbCBiZSB1c2VkLiBcblx0ICpcblx0ICogTm90ZSB0aGF0IHNoYWRlcnMgYXJlIGJvdW5kIG9uIGJhdGNoLmJlZ2luKCkuXG5cdCAqXG5cdCAqIEBwcm9wZXJ0eSBzaGFkZXJcblx0ICogQHR5cGUge1NoYWRlclByb2dyYW19XG5cdCAqL1xuXHRzaGFkZXI6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dmFyIHdhc0RyYXdpbmcgPSB0aGlzLmRyYXdpbmc7XG5cblx0XHRcdGlmICh3YXNEcmF3aW5nKSB7XG5cdFx0XHRcdHRoaXMuZW5kKCk7IC8vdW5iaW5kcyB0aGUgc2hhZGVyIGZyb20gdGhlIG1lc2hcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fc2hhZGVyID0gdmFsID8gdmFsIDogdGhpcy5kZWZhdWx0U2hhZGVyO1xuXG5cdFx0XHRpZiAod2FzRHJhd2luZykge1xuXHRcdFx0XHR0aGlzLmJlZ2luKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2hhZGVyO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY29sb3Igb2YgdGhpcyBzcHJpdGUgYmF0Y2hlciwgd2hpY2ggaXMgdXNlZCBpbiBzdWJzZXF1ZW50IGRyYXdcblx0ICogY2FsbHMuIFRoaXMgZG9lcyBub3QgZmx1c2ggdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBJZiByLCBnLCBiLCBhcmUgYWxsIG51bWJlcnMsIHRoaXMgbWV0aG9kIGFzc3VtZXMgdGhhdCBSR0IgXG5cdCAqIG9yIFJHQkEgZmxvYXQgdmFsdWVzICgwLjAgdG8gMS4wKSBhcmUgYmVpbmcgcGFzc2VkLiBBbHBoYSBkZWZhdWx0cyB0byBvbmVcblx0ICogaWYgdW5kZWZpbmVkLlxuXHQgKiBcblx0ICogSWYgdGhlIGZpcnN0IHRocmVlIGFyZ3VtZW50cyBhcmUgbm90IG51bWJlcnMsIHdlIG9ubHkgY29uc2lkZXIgdGhlIGZpcnN0IGFyZ3VtZW50XG5cdCAqIGFuZCBhc3NpZ24gaXQgdG8gYWxsIGZvdXIgY29tcG9uZW50cyAtLSB0aGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB0cmFuc3BhcmVuY3kgXG5cdCAqIGluIGEgcHJlbXVsdGlwbGllZCBhbHBoYSBzdGFnZS4gXG5cdCAqIFxuXHQgKiBJZiB0aGUgZmlyc3QgYXJndW1lbnQgaXMgaW52YWxpZCBvciBub3QgYSBudW1iZXIsXG5cdCAqIHRoZSBjb2xvciBkZWZhdWx0cyB0byAoMSwgMSwgMSwgMSkuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldENvbG9yXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSByZWQgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBncmVlbiBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIGJsdWUgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBhbHBoYSBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICovXG5cdHNldENvbG9yOiBmdW5jdGlvbihyLCBnLCBiLCBhKSB7XG5cdFx0dmFyIHJudW0gPSB0eXBlb2YgciA9PT0gXCJudW1iZXJcIjtcblx0XHRpZiAocm51bVxuXHRcdFx0XHQmJiB0eXBlb2YgZyA9PT0gXCJudW1iZXJcIlxuXHRcdFx0XHQmJiB0eXBlb2YgYiA9PT0gXCJudW1iZXJcIikge1xuXHRcdFx0Ly9kZWZhdWx0IGFscGhhIHRvIG9uZSBcblx0XHRcdGEgPSAoYSB8fCBhID09PSAwKSA/IGEgOiAxLjA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHIgPSBnID0gYiA9IGEgPSBybnVtID8gciA6IDEuMDtcblx0XHR9XG5cdFx0XG5cdFx0aWYgKHRoaXMucHJlbXVsdGlwbGllZCkge1xuXHRcdFx0ciAqPSBhO1xuXHRcdFx0ZyAqPSBhO1xuXHRcdFx0YiAqPSBhO1xuXHRcdH1cblx0XHRcblx0XHR0aGlzLmNvbG9yID0gY29sb3JUb0Zsb2F0KFxuXHRcdFx0fn4ociAqIDI1NSksXG5cdFx0XHR+fihnICogMjU1KSxcblx0XHRcdH5+KGIgKiAyNTUpLFxuXHRcdFx0fn4oYSAqIDI1NSlcblx0XHQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgZnJvbSB0aGUgY29uc3RydWN0b3IgdG8gY3JlYXRlIGEgbmV3IE1lc2ggXG5cdCAqIGJhc2VkIG9uIHRoZSBleHBlY3RlZCBiYXRjaCBzaXplLiBTaG91bGQgc2V0IHVwXG5cdCAqIHZlcnRzICYgaW5kaWNlcyBwcm9wZXJseS5cblx0ICpcblx0ICogVXNlcnMgc2hvdWxkIG5vdCBjYWxsIHRoaXMgZGlyZWN0bHk7IGluc3RlYWQsIGl0XG5cdCAqIHNob3VsZCBvbmx5IGJlIGltcGxlbWVudGVkIGJ5IHN1YmNsYXNzZXMuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIF9jcmVhdGVNZXNoXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBzaXplIHBhc3NlZCB0aHJvdWdoIHRoZSBjb25zdHJ1Y3RvclxuXHQgKi9cblx0X2NyZWF0ZU1lc2g6IGZ1bmN0aW9uKHNpemUpIHtcblx0XHQvL3RoZSB0b3RhbCBudW1iZXIgb2YgZmxvYXRzIGluIG91ciBiYXRjaFxuXHRcdHZhciBudW1WZXJ0cyA9IHNpemUgKiA0ICogdGhpcy5nZXRWZXJ0ZXhTaXplKCk7XG5cdFx0Ly90aGUgdG90YWwgbnVtYmVyIG9mIGluZGljZXMgaW4gb3VyIGJhdGNoXG5cdFx0dmFyIG51bUluZGljZXMgPSBzaXplICogNjtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHQvL3ZlcnRleCBkYXRhXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkobnVtVmVydHMpO1xuXHRcdC8vaW5kZXggZGF0YVxuXHRcdHRoaXMuaW5kaWNlcyA9IG5ldyBVaW50MTZBcnJheShudW1JbmRpY2VzKTsgXG5cdFx0XG5cdFx0Zm9yICh2YXIgaT0wLCBqPTA7IGkgPCBudW1JbmRpY2VzOyBpICs9IDYsIGogKz0gNCkgXG5cdFx0e1xuXHRcdFx0dGhpcy5pbmRpY2VzW2kgKyAwXSA9IGogKyAwOyBcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMV0gPSBqICsgMTtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMl0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgM10gPSBqICsgMDtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNF0gPSBqICsgMjtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgNV0gPSBqICsgMztcblx0XHR9XG5cblx0XHR2YXIgbWVzaCA9IG5ldyBNZXNoKHRoaXMuY29udGV4dCwgZmFsc2UsIFxuXHRcdFx0XHRcdFx0bnVtVmVydHMsIG51bUluZGljZXMsIHRoaXMuX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXMoKSk7XG5cdFx0bWVzaC52ZXJ0aWNlcyA9IHRoaXMudmVydGljZXM7XG5cdFx0bWVzaC5pbmRpY2VzID0gdGhpcy5pbmRpY2VzO1xuXHRcdG1lc2gudmVydGV4VXNhZ2UgPSBnbC5EWU5BTUlDX0RSQVc7XG5cdFx0bWVzaC5pbmRleFVzYWdlID0gZ2wuU1RBVElDX0RSQVc7XG5cdFx0bWVzaC5kaXJ0eSA9IHRydWU7XG5cdFx0cmV0dXJuIG1lc2g7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzaGFkZXIgZm9yIHRoaXMgYmF0Y2guIElmIHlvdSBwbGFuIHRvIHN1cHBvcnRcblx0ICogbXVsdGlwbGUgaW5zdGFuY2VzIG9mIHlvdXIgYmF0Y2gsIGl0IG1heSBvciBtYXkgbm90IGJlIHdpc2Vcblx0ICogdG8gdXNlIGEgc2hhcmVkIHNoYWRlciB0byBzYXZlIHJlc291cmNlcy5cblx0ICogXG5cdCAqIFRoaXMgbWV0aG9kIGluaXRpYWxseSB0aHJvd3MgYW4gZXJyb3I7IHNvIGl0IG11c3QgYmUgb3ZlcnJpZGRlbiBieVxuXHQgKiBzdWJjbGFzc2VzIG9mIEJhc2VCYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBzaXplIG9mIGEgdmVydGV4LCBpbiAjIG9mIGZsb2F0c1xuXHQgKi9cblx0X2NyZWF0ZVNoYWRlcjogZnVuY3Rpb24oKSB7XG5cdFx0dGhyb3cgXCJfY3JlYXRlU2hhZGVyIG5vdCBpbXBsZW1lbnRlZFwiXG5cdH0sXHRcblxuXHQvKipcblx0ICogUmV0dXJucyBhbiBhcnJheSBvZiB2ZXJ0ZXggYXR0cmlidXRlcyBmb3IgdGhpcyBtZXNoOyBcblx0ICogc3ViY2xhc3NlcyBzaG91bGQgaW1wbGVtZW50IHRoaXMgd2l0aCB0aGUgYXR0cmlidXRlcyBcblx0ICogZXhwZWN0ZWQgZm9yIHRoZWlyIGJhdGNoLlxuXHQgKlxuXHQgKiBUaGlzIG1ldGhvZCBpbml0aWFsbHkgdGhyb3dzIGFuIGVycm9yOyBzbyBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYnlcblx0ICogc3ViY2xhc3NlcyBvZiBCYXNlQmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgX2NyZWF0ZVZlcnRleEF0dHJpYnV0ZXNcblx0ICogQHJldHVybiB7QXJyYXl9IGFuIGFycmF5IG9mIE1lc2guVmVydGV4QXR0cmliIG9iamVjdHNcblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcIl9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzIG5vdCBpbXBsZW1lbnRlZFwiO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleCBmb3IgdGhpcyBiYXRjaGVyLlxuXHQgKiBcblx0ICogVGhpcyBtZXRob2QgaW5pdGlhbGx5IHRocm93cyBhbiBlcnJvcjsgc28gaXQgbXVzdCBiZSBvdmVycmlkZGVuIGJ5XG5cdCAqIHN1YmNsYXNzZXMgb2YgQmFzZUJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIHNpemUgb2YgYSB2ZXJ0ZXgsIGluICMgb2YgZmxvYXRzXG5cdCAqL1xuXHRnZXRWZXJ0ZXhTaXplOiBmdW5jdGlvbigpIHtcblx0XHR0aHJvdyBcImdldFZlcnRleFNpemUgbm90IGltcGxlbWVudGVkXCI7XG5cdH0sXG5cblx0XG5cdC8qKiBcblx0ICogQmVnaW5zIHRoZSBzcHJpdGUgYmF0Y2guIFRoaXMgd2lsbCBiaW5kIHRoZSBzaGFkZXJcblx0ICogYW5kIG1lc2guIFN1YmNsYXNzZXMgbWF5IHdhbnQgdG8gZGlzYWJsZSBkZXB0aCBvciBcblx0ICogc2V0IHVwIGJsZW5kaW5nLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5kcmF3aW5nKSBcblx0XHRcdHRocm93IFwiYmF0Y2guZW5kKCkgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIGJlZ2luXCI7XG5cdFx0dGhpcy5kcmF3aW5nID0gdHJ1ZTtcblxuXHRcdHRoaXMuc2hhZGVyLmJpbmQoKTtcblxuXHRcdC8vYmluZCB0aGUgYXR0cmlidXRlcyBub3cgdG8gYXZvaWQgcmVkdW5kYW50IGNhbGxzXG5cdFx0dGhpcy5tZXNoLmJpbmQodGhpcy5zaGFkZXIpO1xuXG5cdFx0aWYgKHRoaXMuX2JsZW5kaW5nRW5hYmxlZCkge1xuXHRcdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFx0Z2wuZW5hYmxlKGdsLkJMRU5EKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBFbmRzIHRoZSBzcHJpdGUgYmF0Y2guIFRoaXMgd2lsbCBmbHVzaCBhbnkgcmVtYWluaW5nIFxuXHQgKiBkYXRhIGFuZCBzZXQgR0wgc3RhdGUgYmFjayB0byBub3JtYWwuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSAge1xuXHRcdGlmICghdGhpcy5kcmF3aW5nKVxuXHRcdFx0dGhyb3cgXCJiYXRjaC5iZWdpbigpIG11c3QgYmUgY2FsbGVkIGJlZm9yZSBlbmRcIjtcblx0XHRpZiAodGhpcy5pZHggPiAwKVxuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdHRoaXMuZHJhd2luZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5tZXNoLnVuYmluZCh0aGlzLnNoYWRlcik7XG5cblx0XHRpZiAodGhpcy5fYmxlbmRpbmdFbmFibGVkKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XHRnbC5kaXNhYmxlKGdsLkJMRU5EKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqIFxuXHQgKiBDYWxsZWQgYmVmb3JlIHJlbmRlcmluZyB0byBiaW5kIG5ldyB0ZXh0dXJlcy5cblx0ICogVGhpcyBtZXRob2QgZG9lcyBub3RoaW5nIGJ5IGRlZmF1bHQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9wcmVSZW5kZXJcblx0ICovXG5cdF9wcmVSZW5kZXI6IGZ1bmN0aW9uKCkgIHtcblx0fSxcblxuXHQvKipcblx0ICogRmx1c2hlcyB0aGUgYmF0Y2ggYnkgcHVzaGluZyB0aGUgY3VycmVudCBkYXRhXG5cdCAqIHRvIEdMLlxuXHQgKiBcblx0ICogQG1ldGhvZCBmbHVzaFxuXHQgKi9cblx0Zmx1c2g6IGZ1bmN0aW9uKCkgIHtcblx0XHRpZiAodGhpcy5pZHg9PT0wKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXG5cdFx0Ly9wcmVtdWx0aXBsaWVkIGFscGhhXG5cdFx0aWYgKHRoaXMuX2JsZW5kaW5nRW5hYmxlZCkge1xuXHRcdFx0Ly9zZXQgZWl0aGVyIHRvIG51bGwgaWYgeW91IHdhbnQgdG8gY2FsbCB5b3VyIG93biBcblx0XHRcdC8vYmxlbmRGdW5jIG9yIGJsZW5kRnVuY1NlcGFyYXRlXG5cdFx0XHRpZiAodGhpcy5fYmxlbmRTcmMgJiYgdGhpcy5fYmxlbmREc3QpXG5cdFx0XHRcdGdsLmJsZW5kRnVuYyh0aGlzLl9ibGVuZFNyYywgdGhpcy5fYmxlbmREc3QpOyBcblx0XHR9XG5cblx0XHR0aGlzLl9wcmVSZW5kZXIoKTtcblxuXHRcdC8vbnVtYmVyIG9mIHNwcml0ZXMgaW4gYmF0Y2hcblx0XHR2YXIgbnVtQ29tcG9uZW50cyA9IHRoaXMuZ2V0VmVydGV4U2l6ZSgpO1xuXHRcdHZhciBzcHJpdGVDb3VudCA9ICh0aGlzLmlkeCAvIChudW1Db21wb25lbnRzICogNCkpO1xuXHRcdFxuXHRcdC8vZHJhdyB0aGUgc3ByaXRlc1xuXHRcdHRoaXMubWVzaC52ZXJ0aWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLm1lc2guZHJhdyhnbC5UUklBTkdMRVMsIHNwcml0ZUNvdW50ICogNiwgMCwgdGhpcy5pZHgpO1xuXG5cdFx0dGhpcy5pZHggPSAwO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc3ByaXRlIHRvIHRoaXMgYmF0Y2guXG5cdCAqIFRoZSBzcGVjaWZpY3MgZGVwZW5kIG9uIHRoZSBzcHJpdGUgYmF0Y2ggaW1wbGVtZW50YXRpb24uXG5cdCAqXG5cdCAqIEBtZXRob2QgZHJhd1xuXHQgKiBAcGFyYW0gIHtUZXh0dXJlfSB0ZXh0dXJlIHRoZSB0ZXh0dXJlIGZvciB0aGlzIHNwcml0ZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHggICAgICAgdGhlIHggcG9zaXRpb24sIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB5ICAgICAgIHRoZSB5IHBvc2l0aW9uLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggICB0aGUgd2lkdGgsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICB0aGUgaGVpZ2h0LCBkZWZhdWx0cyB0byB0aGUgdGV4dHVyZSBoZWlnaHRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MSAgICAgIHRoZSBmaXJzdCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYxICAgICAgdGhlIGZpcnN0IFYgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTIgICAgICB0aGUgc2Vjb25kIFUgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MiAgICAgIHRoZSBzZWNvbmQgViBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKi9cblx0ZHJhdzogZnVuY3Rpb24odGV4dHVyZSwgeCwgeSwgd2lkdGgsIGhlaWdodCwgdTEsIHYxLCB1MiwgdjIpIHtcblx0fSxcblxuXHQvKipcblx0ICogQWRkcyBhIHNpbmdsZSBxdWFkIG1lc2ggdG8gdGhpcyBzcHJpdGUgYmF0Y2ggZnJvbSB0aGUgZ2l2ZW5cblx0ICogYXJyYXkgb2YgdmVydGljZXMuXG5cdCAqIFRoZSBzcGVjaWZpY3MgZGVwZW5kIG9uIHRoZSBzcHJpdGUgYmF0Y2ggaW1wbGVtZW50YXRpb24uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGRyYXdWZXJ0aWNlc1xuXHQgKiBAcGFyYW0ge1RleHR1cmV9IHRleHR1cmUgdGhlIHRleHR1cmUgd2UgYXJlIGRyYXdpbmcgZm9yIHRoaXMgc3ByaXRlXG5cdCAqIEBwYXJhbSB7RmxvYXQzMkFycmF5fSB2ZXJ0cyBhbiBhcnJheSBvZiB2ZXJ0aWNlc1xuXHQgKiBAcGFyYW0ge051bWJlcn0gb2ZmIHRoZSBvZmZzZXQgaW50byB0aGUgdmVydGljZXMgYXJyYXkgdG8gcmVhZCBmcm9tXG5cdCAqL1xuXHRkcmF3VmVydGljZXM6IGZ1bmN0aW9uKHRleHR1cmUsIHZlcnRzLCBvZmYpICB7XG5cdH0sXG5cblx0ZHJhd1JlZ2lvbjogZnVuY3Rpb24ocmVnaW9uLCB4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG5cdFx0dGhpcy5kcmF3KHJlZ2lvbi50ZXh0dXJlLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCByZWdpb24udSwgcmVnaW9uLnYsIHJlZ2lvbi51MiwgcmVnaW9uLnYyKTtcblx0fSxcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIGJhdGNoLCBkZWxldGluZyBpdHMgYnVmZmVycyBhbmQgcmVtb3ZpbmcgaXQgZnJvbSB0aGVcblx0ICogV2ViR0xDb250ZXh0IG1hbmFnZW1lbnQuIFRyeWluZyB0byB1c2UgdGhpc1xuXHQgKiBiYXRjaCBhZnRlciBkZXN0cm95aW5nIGl0IGNhbiBsZWFkIHRvIHVucHJlZGljdGFibGUgYmVoYXZpb3VyLlxuXHQgKlxuXHQgKiBJZiBgb3duc1NoYWRlcmAgaXMgdHJ1ZSwgdGhpcyB3aWxsIGFsc28gZGVsZXRlIHRoZSBgZGVmYXVsdFNoYWRlcmAgb2JqZWN0LlxuXHQgKiBcblx0ICogQG1ldGhvZCBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRpY2VzID0gbnVsbDtcblx0XHR0aGlzLmluZGljZXMgPSBudWxsO1xuXHRcdHRoaXMuc2l6ZSA9IHRoaXMubWF4VmVydGljZXMgPSAwO1xuXG5cdFx0aWYgKHRoaXMub3duc1NoYWRlciAmJiB0aGlzLmRlZmF1bHRTaGFkZXIpXG5cdFx0XHR0aGlzLmRlZmF1bHRTaGFkZXIuZGVzdHJveSgpO1xuXHRcdHRoaXMuZGVmYXVsdFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5fc2hhZGVyID0gbnVsbDsgLy8gcmVtb3ZlIHJlZmVyZW5jZSB0byB3aGF0ZXZlciBzaGFkZXIgaXMgY3VycmVudGx5IGJlaW5nIHVzZWRcblxuXHRcdGlmICh0aGlzLm1lc2gpIFxuXHRcdFx0dGhpcy5tZXNoLmRlc3Ryb3koKTtcblx0XHR0aGlzLm1lc2ggPSBudWxsO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbi8vIFJlcXVpcmVzLi4uLlxudmFyIENsYXNzICAgICAgICAgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxudmFyIEJhc2VCYXRjaCA9IHJlcXVpcmUoJy4vQmFzZUJhdGNoJyk7XG5cbnZhciBNZXNoICAgICAgICAgID0gcmVxdWlyZSgnLi9nbHV0aWxzL01lc2gnKTtcbnZhciBTaGFkZXJQcm9ncmFtID0gcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0nKTtcblxuLyoqXG4gKiBBIGJhc2ljIGltcGxlbWVudGF0aW9uIG9mIGEgYmF0Y2hlciB3aGljaCBkcmF3cyAyRCBzcHJpdGVzLlxuICogVGhpcyB1c2VzIHR3byB0cmlhbmdsZXMgKHF1YWRzKSB3aXRoIGluZGV4ZWQgYW5kIGludGVybGVhdmVkXG4gKiB2ZXJ0ZXggZGF0YS4gRWFjaCB2ZXJ0ZXggaG9sZHMgNSBmbG9hdHMgKFBvc2l0aW9uLnh5LCBDb2xvciwgVGV4Q29vcmQwLnh5KS5cbiAqXG4gKiBUaGUgY29sb3IgaXMgcGFja2VkIGludG8gYSBzaW5nbGUgZmxvYXQgdG8gcmVkdWNlIHZlcnRleCBiYW5kd2lkdGgsIGFuZFxuICogdGhlIGRhdGEgaXMgaW50ZXJsZWF2ZWQgZm9yIGJlc3QgcGVyZm9ybWFuY2UuIFdlIHVzZSBhIHN0YXRpYyBpbmRleCBidWZmZXIsXG4gKiBhbmQgYSBkeW5hbWljIHZlcnRleCBidWZmZXIgdGhhdCBpcyB1cGRhdGVkIHdpdGggYnVmZmVyU3ViRGF0YS4gXG4gKiBcbiAqIEBleGFtcGxlXG4gKiAgICAgIHZhciBTcHJpdGVCYXRjaCA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDsgIFxuICogICAgICBcbiAqICAgICAgLy9jcmVhdGUgYSBuZXcgYmF0Y2hlclxuICogICAgICB2YXIgYmF0Y2ggPSBuZXcgU3ByaXRlQmF0Y2goY29udGV4dCk7XG4gKlxuICogICAgICBmdW5jdGlvbiByZW5kZXIoKSB7XG4gKiAgICAgICAgICBiYXRjaC5iZWdpbigpO1xuICogICAgICAgICAgXG4gKiAgICAgICAgICAvL2RyYXcgc29tZSBzcHJpdGVzIGluIGJldHdlZW4gYmVnaW4gYW5kIGVuZC4uLlxuICogICAgICAgICAgYmF0Y2guZHJhdyggdGV4dHVyZSwgMCwgMCwgMjUsIDMyICk7XG4gKiAgICAgICAgICBiYXRjaC5kcmF3KCB0ZXh0dXJlMSwgMCwgMjUsIDQyLCAyMyApO1xuICogXG4gKiAgICAgICAgICBiYXRjaC5lbmQoKTtcbiAqICAgICAgfVxuICogXG4gKiBAY2xhc3MgIFNwcml0ZUJhdGNoXG4gKiBAdXNlcyBCYXNlQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIGNvbnRleHQgZm9yIHRoaXMgYmF0Y2hcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBtYXggbnVtYmVyIG9mIHNwcml0ZXMgdG8gZml0IGluIGEgc2luZ2xlIGJhdGNoXG4gKi9cbnZhciBTcHJpdGVCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9pbmhlcml0IHNvbWUgc3R1ZmYgb250byB0aGlzIHByb3RvdHlwZVxuXHRNaXhpbnM6IEJhc2VCYXRjaCxcblxuXHQvL0NvbnN0cnVjdG9yXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFNwcml0ZUJhdGNoKGNvbnRleHQsIHNpemUpIHtcblx0XHRCYXNlQmF0Y2guY2FsbCh0aGlzLCBjb250ZXh0LCBzaXplKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBwcm9qZWN0aW9uIEZsb2F0MzJBcnJheSB2ZWMyIHdoaWNoIGlzXG5cdFx0ICogdXNlZCB0byBhdm9pZCBzb21lIG1hdHJpeCBjYWxjdWxhdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgcHJvamVjdGlvblxuXHRcdCAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG5cdFx0ICovXG5cdFx0dGhpcy5wcm9qZWN0aW9uID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuXHRcdC8vU2V0cyB1cCBhIGRlZmF1bHQgcHJvamVjdGlvbiB2ZWN0b3Igc28gdGhhdCB0aGUgYmF0Y2ggd29ya3Mgd2l0aG91dCBzZXRQcm9qZWN0aW9uXG5cdFx0dGhpcy5wcm9qZWN0aW9uWzBdID0gdGhpcy5jb250ZXh0LndpZHRoLzI7XG5cdFx0dGhpcy5wcm9qZWN0aW9uWzFdID0gdGhpcy5jb250ZXh0LmhlaWdodC8yO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGN1cnJlbnRseSBib3VuZCB0ZXh0dXJlLiBEbyBub3QgbW9kaWZ5LlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gdGV4dHVyZVxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqL1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiB0byBzZXQgdGhlIGJhdGNoJ3MgcHJvamVjdGlvblxuXHQgKiBtYXRyaXggdG8gYW4gb3J0aG9ncmFwaGljIDJEIHByb2plY3Rpb24sIGJhc2VkIG9uIHRoZSBnaXZlbiBzY3JlZW5cblx0ICogc2l6ZS4gVGhpcyBhbGxvd3MgdXNlcnMgdG8gcmVuZGVyIGluIDJEIHdpdGhvdXQgYW55IG5lZWQgZm9yIGEgY2FtZXJhLlxuXHQgKiBcblx0ICogQHBhcmFtICB7W3R5cGVdfSB3aWR0aCAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGhlaWdodCBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdHJlc2l6ZTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMuc2V0UHJvamVjdGlvbih3aWR0aC8yLCBoZWlnaHQvMik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXggZm9yIHRoaXMgYmF0Y2hlciBcblx0ICogKFBvc2l0aW9uLnh5ICsgQ29sb3IgKyBUZXhDb29yZDAueHkpLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleFxuXHQgKi9cblx0Z2V0VmVydGV4U2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIFNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVc2VkIGludGVybmFsbHkgdG8gcmV0dXJuIHRoZSBQb3NpdGlvbiwgQ29sb3IsIGFuZCBUZXhDb29yZDAgYXR0cmlidXRlcy5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVZlcnRleEF0dHJpYnVldHNcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHRyZXR1cm4gWyBcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURSwgMiksXG5cdFx0XHQgLy9wYWNrIHRoZSBjb2xvciB1c2luZyBzb21lIGNyYXp5IHdpemFyZHJ5IFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFNoYWRlclByb2dyYW0uQ09MT1JfQVRUUklCVVRFLCA0LCBudWxsLCBnbC5VTlNJR05FRF9CWVRFLCB0cnVlLCAxKSxcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihTaGFkZXJQcm9ncmFtLlRFWENPT1JEX0FUVFJJQlVURStcIjBcIiwgMilcblx0XHRdO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIFNldHMgdGhlIHByb2plY3Rpb24gdmVjdG9yLCBhbiB4IGFuZCB5XG5cdCAqIGRlZmluaW5nIHRoZSBtaWRkbGUgcG9pbnRzIG9mIHlvdXIgc3RhZ2UuXG5cdCAqXG5cdCAqIEBtZXRob2Qgc2V0UHJvamVjdGlvblxuXHQgKiBAcGFyYW0ge051bWJlcn0geCB0aGUgeCBwcm9qZWN0aW9uIHZhbHVlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSB5IHRoZSB5IHByb2plY3Rpb24gdmFsdWVcblx0ICovXG5cdHNldFByb2plY3Rpb246IGZ1bmN0aW9uKHgsIHkpIHtcblx0XHR2YXIgb2xkWCA9IHRoaXMucHJvamVjdGlvblswXTtcblx0XHR2YXIgb2xkWSA9IHRoaXMucHJvamVjdGlvblsxXTtcblx0XHR0aGlzLnByb2plY3Rpb25bMF0gPSB4O1xuXHRcdHRoaXMucHJvamVjdGlvblsxXSA9IHk7XG5cblx0XHQvL3dlIG5lZWQgdG8gZmx1c2ggdGhlIGJhdGNoLi5cblx0XHRpZiAodGhpcy5kcmF3aW5nICYmICh4ICE9IG9sZFggfHwgeSAhPSBvbGRZKSkge1xuXHRcdFx0dGhpcy5mbHVzaCgpO1xuXHRcdFx0dGhpcy5fdXBkYXRlTWF0cmljZXMoKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBkZWZhdWx0IHNoYWRlciBmb3IgdGhpcyBiYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVNoYWRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEByZXR1cm4ge1NoYWRlclByb2dyYW19IGEgbmV3IGluc3RhbmNlIG9mIFNoYWRlclByb2dyYW1cblx0ICovXG5cdF9jcmVhdGVTaGFkZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBzaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbSh0aGlzLmNvbnRleHQsXG5cdFx0XHRcdFNwcml0ZUJhdGNoLkRFRkFVTFRfVkVSVF9TSEFERVIsIFxuXHRcdFx0XHRTcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSKTtcblx0XHRpZiAoc2hhZGVyLmxvZylcblx0XHRcdGNvbnNvbGUud2FybihcIlNoYWRlciBMb2c6XFxuXCIgKyBzaGFkZXIubG9nKTtcblx0XHRyZXR1cm4gc2hhZGVyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGNhbGxlZCBkdXJpbmcgcmVuZGVyaW5nIHRvIHVwZGF0ZSBwcm9qZWN0aW9uL3RyYW5zZm9ybVxuXHQgKiBtYXRyaWNlcyBhbmQgdXBsb2FkIHRoZSBuZXcgdmFsdWVzIHRvIHRoZSBzaGFkZXIuIEZvciBleGFtcGxlLFxuXHQgKiBpZiB0aGUgdXNlciBjYWxscyBzZXRQcm9qZWN0aW9uIG1pZC1kcmF3LCB0aGUgYmF0Y2ggd2lsbCBmbHVzaFxuXHQgKiBhbmQgdGhpcyB3aWxsIGJlIGNhbGxlZCBiZWZvcmUgY29udGludWluZyB0byBhZGQgaXRlbXMgdG8gdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBZb3UgZ2VuZXJhbGx5IHNob3VsZCBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICB1cGRhdGVNYXRyaWNlc1xuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHR1cGRhdGVNYXRyaWNlczogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5zaGFkZXIuc2V0VW5pZm9ybWZ2KFwidV9wcm9qZWN0aW9uXCIsIHRoaXMucHJvamVjdGlvbik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxlZCBiZWZvcmUgcmVuZGVyaW5nLCBhbmQgYmluZHMgdGhlIGN1cnJlbnQgdGV4dHVyZS5cblx0ICogXG5cdCAqIEBtZXRob2QgX3ByZVJlbmRlclxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqL1xuXHRfcHJlUmVuZGVyOiBmdW5jdGlvbigpIHtcblx0XHRpZiAodGhpcy50ZXh0dXJlKVxuXHRcdFx0dGhpcy50ZXh0dXJlLmJpbmQoKTtcblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIHNoYWRlciwgZGlzYWJsZXMgZGVwdGggd3JpdGluZywgXG5cdCAqIGVuYWJsZXMgYmxlbmRpbmcsIGFjdGl2YXRlcyB0ZXh0dXJlIHVuaXQgMCwgYW5kIHNlbmRzXG5cdCAqIGRlZmF1bHQgbWF0cmljZXMgYW5kIHNhbXBsZXIyRCB1bmlmb3JtcyB0byB0aGUgc2hhZGVyLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdC8vc3ByaXRlIGJhdGNoIGRvZXNuJ3QgaG9sZCBhIHJlZmVyZW5jZSB0byBHTCBzaW5jZSBpdCBpcyB2b2xhdGlsZVxuXHRcdHZhciBnbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHRcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmJlZ2luLmNhbGwodGhpcyk7XG5cblx0XHR0aGlzLnVwZGF0ZU1hdHJpY2VzKCk7IC8vc2VuZCBwcm9qZWN0aW9uL3RyYW5zZm9ybSB0byBzaGFkZXJcblxuXHRcdC8vdXBsb2FkIHRoZSBzYW1wbGVyIHVuaWZvcm0uIG5vdCBuZWNlc3NhcnkgZXZlcnkgZmx1c2ggc28gd2UganVzdFxuXHRcdC8vZG8gaXQgaGVyZS5cblx0XHR0aGlzLnNoYWRlci5zZXRVbmlmb3JtaShcInVfdGV4dHVyZTBcIiwgMCk7XG5cblx0XHQvL2Rpc2FibGUgZGVwdGggbWFza1xuXHRcdGdsLmRlcHRoTWFzayhmYWxzZSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEVuZHMgdGhlIHNwcml0ZSBiYXRjaGVyIGFuZCBmbHVzaGVzIGFueSByZW1haW5pbmcgZGF0YSB0byB0aGUgR1BVLlxuXHQgKiBcblx0ICogQG1ldGhvZCBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0Ly9zcHJpdGUgYmF0Y2ggZG9lc24ndCBob2xkIGEgcmVmZXJlbmNlIHRvIEdMIHNpbmNlIGl0IGlzIHZvbGF0aWxlXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFxuXHRcdC8vanVzdCBkbyBkaXJlY3QgcGFyZW50IGNhbGwgZm9yIHNwZWVkIGhlcmVcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmVuZC5jYWxsKHRoaXMpO1xuXG5cdFx0Z2wuZGVwdGhNYXNrKHRydWUpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGbHVzaGVzIHRoZSBiYXRjaCB0byB0aGUgR1BVLiBUaGlzIHNob3VsZCBiZSBjYWxsZWQgd2hlblxuXHQgKiBzdGF0ZSBjaGFuZ2VzLCBzdWNoIGFzIGJsZW5kIGZ1bmN0aW9ucywgZGVwdGggb3Igc3RlbmNpbCBzdGF0ZXMsXG5cdCAqIHNoYWRlcnMsIGFuZCBzbyBmb3J0aC5cblx0ICogXG5cdCAqIEBtZXRob2QgZmx1c2hcblx0ICovXG5cdGZsdXNoOiBmdW5jdGlvbigpIHtcblx0XHQvL2lnbm9yZSBmbHVzaCBpZiB0ZXh0dXJlIGlzIG51bGwgb3Igb3VyIGJhdGNoIGlzIGVtcHR5XG5cdFx0aWYgKCF0aGlzLnRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cdFx0aWYgKHRoaXMuaWR4ID09PSAwKVxuXHRcdFx0cmV0dXJuO1xuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuZmx1c2guY2FsbCh0aGlzKTtcblx0XHRTcHJpdGVCYXRjaC50b3RhbFJlbmRlckNhbGxzKys7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzcHJpdGUgdG8gdGhpcyBiYXRjaC4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGRyYXdcblx0ICogQHBhcmFtICB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHggICAgICAgdGhlIHggcG9zaXRpb24gaW4gcGl4ZWxzLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0geSAgICAgICB0aGUgeSBwb3NpdGlvbiBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgIHRoZSB3aWR0aCBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICB0aGUgaGVpZ2h0IGluIHBpeGVscywgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgaGVpZ2h0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTEgICAgICB0aGUgZmlyc3QgVSBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MSAgICAgIHRoZSBmaXJzdCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUyICAgICAgdGhlIHNlY29uZCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjIgICAgICB0aGUgc2Vjb25kIFYgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICovXG5cdGRyYXc6IGZ1bmN0aW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHUxLCB2MSwgdTIsIHYyKSB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcIklsbGVnYWwgU3RhdGU6IHRyeWluZyB0byBkcmF3IGEgYmF0Y2ggYmVmb3JlIGJlZ2luKClcIjtcblxuXHRcdC8vZG9uJ3QgZHJhdyBhbnl0aGluZyBpZiBHTCB0ZXggZG9lc24ndCBleGlzdC4uXG5cdFx0aWYgKCF0ZXh0dXJlKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSA9PT0gbnVsbCB8fCB0aGlzLnRleHR1cmUuaWQgIT09IHRleHR1cmUuaWQpIHtcblx0XHRcdC8vbmV3IHRleHR1cmUuLiBmbHVzaCBwcmV2aW91cyBkYXRhXG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pZHggPT0gdGhpcy52ZXJ0aWNlcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZmx1c2goKTsgLy93ZSd2ZSByZWFjaGVkIG91ciBtYXgsIGZsdXNoIGJlZm9yZSBwdXNoaW5nIG1vcmUgZGF0YVxuXHRcdH1cblxuXHRcdHdpZHRoID0gKHdpZHRoPT09MCkgPyB3aWR0aCA6ICh3aWR0aCB8fCB0ZXh0dXJlLndpZHRoKTtcblx0XHRoZWlnaHQgPSAoaGVpZ2h0PT09MCkgPyBoZWlnaHQgOiAoaGVpZ2h0IHx8IHRleHR1cmUuaGVpZ2h0KTtcblx0XHR4ID0geCB8fCAwO1xuXHRcdHkgPSB5IHx8IDA7XG5cblx0XHR2YXIgeDEgPSB4O1xuXHRcdHZhciB4MiA9IHggKyB3aWR0aDtcblx0XHR2YXIgeTEgPSB5O1xuXHRcdHZhciB5MiA9IHkgKyBoZWlnaHQ7XG5cblx0XHR1MSA9IHUxIHx8IDA7XG5cdFx0dTIgPSAodTI9PT0wKSA/IHUyIDogKHUyIHx8IDEpO1xuXHRcdHYxID0gdjEgfHwgMDtcblx0XHR2MiA9ICh2Mj09PTApID8gdjIgOiAodjIgfHwgMSk7XG5cblx0XHR2YXIgYyA9IHRoaXMuY29sb3I7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5MTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjE7XG5cdFx0XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTE7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYxO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTE7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc2luZ2xlIHF1YWQgbWVzaCB0byB0aGlzIHNwcml0ZSBiYXRjaCBmcm9tIHRoZSBnaXZlblxuXHQgKiBhcnJheSBvZiB2ZXJ0aWNlcy4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqXG5cdCAqIFRoaXMgcmVhZHMgMjAgaW50ZXJsZWF2ZWQgZmxvYXRzIGZyb20gdGhlIGdpdmVuIG9mZnNldCBpbmRleCwgaW4gdGhlIGZvcm1hdFxuXHQgKlxuXHQgKiAgeyB4LCB5LCBjb2xvciwgdSwgdixcblx0ICogICAgICAuLi4gIH1cblx0ICpcblx0ICogQG1ldGhvZCAgZHJhd1ZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZSBvYmplY3Rcblx0ICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IHZlcnRzIGFuIGFycmF5IG9mIHZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBvZmYgdGhlIG9mZnNldCBpbnRvIHRoZSB2ZXJ0aWNlcyBhcnJheSB0byByZWFkIGZyb21cblx0ICovXG5cdGRyYXdWZXJ0aWNlczogZnVuY3Rpb24odGV4dHVyZSwgdmVydHMsIG9mZikge1xuXHRcdGlmICghdGhpcy5kcmF3aW5nKVxuXHRcdFx0dGhyb3cgXCJJbGxlZ2FsIFN0YXRlOiB0cnlpbmcgdG8gZHJhdyBhIGJhdGNoIGJlZm9yZSBiZWdpbigpXCI7XG5cdFx0XG5cdFx0Ly9kb24ndCBkcmF3IGFueXRoaW5nIGlmIEdMIHRleCBkb2Vzbid0IGV4aXN0Li5cblx0XHRpZiAoIXRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cblxuXHRcdGlmICh0aGlzLnRleHR1cmUgIT0gdGV4dHVyZSkge1xuXHRcdFx0Ly9uZXcgdGV4dHVyZS4uIGZsdXNoIHByZXZpb3VzIGRhdGFcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlkeCA9PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5mbHVzaCgpOyAvL3dlJ3ZlIHJlYWNoZWQgb3VyIG1heCwgZmx1c2ggYmVmb3JlIHB1c2hpbmcgbW9yZSBkYXRhXG5cdFx0fVxuXG5cdFx0b2ZmID0gb2ZmIHx8IDA7XG5cdFx0Ly9UT0RPOiB1c2UgYSBsb29wIGhlcmU/XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdFxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0fVxufSk7XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgdmVydGV4IHNpemUsIGkuZS4gbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4LlxuICogQGF0dHJpYnV0ZSAgVkVSVEVYX1NJWkVcbiAqIEBzdGF0aWNcbiAqIEBmaW5hbFxuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICA1XG4gKi9cblNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFID0gNTtcblxuLyoqXG4gKiBJbmNyZW1lbnRlZCBhZnRlciBlYWNoIGRyYXcgY2FsbCwgY2FuIGJlIHVzZWQgZm9yIGRlYnVnZ2luZy5cbiAqXG4gKiAgICAgU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyA9IDA7XG4gKlxuICogICAgIC4uLiBkcmF3IHlvdXIgc2NlbmUgLi4uXG4gKlxuICogICAgIGNvbnNvbGUubG9nKFwiRHJhdyBjYWxscyBwZXIgZnJhbWU6XCIsIFNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMpO1xuICpcbiAqIFxuICogQGF0dHJpYnV0ZSAgdG90YWxSZW5kZXJDYWxsc1xuICogQHN0YXRpY1xuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICAwXG4gKi9cblNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMgPSAwO1xuXG5TcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSID0gW1xuXHRcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cdFwidW5pZm9ybSBzYW1wbGVyMkQgdV90ZXh0dXJlMDtcIixcblxuXHRcInZvaWQgbWFpbih2b2lkKSB7XCIsXG5cdFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVfdGV4dHVyZTAsIHZUZXhDb29yZDApICogdkNvbG9yO1wiLFxuXHRcIn1cIlxuXS5qb2luKCdcXG4nKTtcblxuU3ByaXRlQmF0Y2guREVGQVVMVF9WRVJUX1NIQURFUiA9IFtcblx0XCJhdHRyaWJ1dGUgdmVjMiBcIitTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURStcIjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjNCBcIitTaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURStcIjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjMiBcIitTaGFkZXJQcm9ncmFtLlRFWENPT1JEX0FUVFJJQlVURStcIjA7XCIsXG5cblx0XCJ1bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cblx0XCJ2b2lkIG1haW4odm9pZCkge1wiLCAvLy9UT0RPOiB1c2UgYSBwcm9qZWN0aW9uIGFuZCB0cmFuc2Zvcm0gbWF0cml4XG5cdFwiICAgZ2xfUG9zaXRpb24gPSB2ZWM0KCBcIlxuXHRcdCtTaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURVxuXHRcdCtcIi54IC8gdV9wcm9qZWN0aW9uLnggLSAxLjAsIFwiXG5cdFx0K1NoYWRlclByb2dyYW0uUE9TSVRJT05fQVRUUklCVVRFXG5cdFx0K1wiLnkgLyAtdV9wcm9qZWN0aW9uLnkgKyAxLjAgLCAwLjAsIDEuMCk7XCIsXG5cdFwiICAgdlRleENvb3JkMCA9IFwiK1NoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFK1wiMDtcIixcblx0XCIgICB2Q29sb3IgPSBcIitTaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURStcIjtcIixcblx0XCJ9XCJcbl0uam9pbignXFxuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gU3ByaXRlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcbnZhciBuZXh0UG93ZXJPZlR3byA9IHJlcXVpcmUoJ251bWJlci11dGlsJykubmV4dFBvd2VyT2ZUd287XG52YXIgaXNQb3dlck9mVHdvID0gcmVxdWlyZSgnbnVtYmVyLXV0aWwnKS5pc1Bvd2VyT2ZUd287XG5cbnZhciBUZXh0dXJlID0gbmV3IENsYXNzKHtcblxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHRleHR1cmUgd2l0aCB0aGUgb3B0aW9uYWwgd2lkdGgsIGhlaWdodCwgYW5kIGRhdGEuXG5cdCAqXG5cdCAqIElmIHRoZSBjb25zdHJ1Y3RvciBpcyBwYXNzZWQgbm8gcGFyYW1ldGVycyBvdGhlciB0aGFuIFdlYkdMQ29udGV4dCwgdGhlblxuXHQgKiBpdCB3aWxsIG5vdCBiZSBpbml0aWFsaXplZCBhbmQgd2lsbCBiZSBub24tcmVuZGVyYWJsZS4gWW91IHdpbGwgbmVlZCB0byBtYW51YWxseVxuXHQgKiB1cGxvYWREYXRhIG9yIHVwbG9hZEltYWdlIHlvdXJzZWxmLlxuXHQgKlxuXHQgKiBJZiB5b3UgcGFzcyBhIHdpZHRoIGFuZCBoZWlnaHQgYWZ0ZXIgY29udGV4dCwgdGhlIHRleHR1cmUgd2lsbCBiZSBpbml0aWFsaXplZCB3aXRoIHRoYXQgc2l6ZVxuXHQgKiBhbmQgbnVsbCBkYXRhIChlLmcuIHRyYW5zcGFyZW50IGJsYWNrKS4gSWYgeW91IGFsc28gcGFzcyB0aGUgZm9ybWF0IGFuZCBkYXRhLCBcblx0ICogaXQgd2lsbCBiZSB1cGxvYWRlZCB0byB0aGUgdGV4dHVyZS4gXG5cdCAqXG5cdCAqIElmIHlvdSBwYXNzIGEgU3RyaW5nIG9yIERhdGEgVVJJIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyLFxuXHQgKiB0aGlzIFRleHR1cmUgd2lsbCBsb2FkIGFuIEltYWdlIG9iamVjdCBhc3luY2hyb25vdXNseS4gVGhlIG9wdGlvbmFsIHRoaXJkXG5cdCAqIGFuZCBmb3VydGggcGFyYW1ldGVycyBhcmUgY2FsbGJhY2sgZnVuY3Rpb25zIGZvciBzdWNjZXNzIGFuZCBmYWlsdXJlLCByZXNwZWN0aXZlbHkuIFxuXHQgKiBUaGUgb3B0aW9uYWwgZmlmcnRoIHBhcmFtZXRlciBmb3IgdGhpcyB2ZXJzaW9uIG9mIHRoZSBjb25zdHJ1Y3RvciBpcyBnZW5NaXBtYXBzLCB3aGljaCBkZWZhdWx0cyB0byBmYWxzZS4gXG5cdCAqIFxuXHQgKiBUaGUgYXJndW1lbnRzIGFyZSBrZXB0IGluIG1lbW9yeSBmb3IgZnV0dXJlIGNvbnRleHQgcmVzdG9yYXRpb24gZXZlbnRzLiBJZlxuXHQgKiB0aGlzIGlzIHVuZGVzaXJhYmxlIChlLmcuIGh1Z2UgYnVmZmVycyB3aGljaCBuZWVkIHRvIGJlIEdDJ2QpLCB5b3Ugc2hvdWxkIG5vdFxuXHQgKiBwYXNzIHRoZSBkYXRhIGluIHRoZSBjb25zdHJ1Y3RvciwgYnV0IGluc3RlYWQgdXBsb2FkIGl0IGFmdGVyIGNyZWF0aW5nIGFuIHVuaW5pdGlhbGl6ZWQgXG5cdCAqIHRleHR1cmUuIFlvdSB3aWxsIG5lZWQgdG8gbWFuYWdlIGl0IHlvdXJzZWxmLCBlaXRoZXIgYnkgZXh0ZW5kaW5nIHRoZSBjcmVhdGUoKSBtZXRob2QsIFxuXHQgKiBvciBsaXN0ZW5pbmcgdG8gcmVzdG9yZWQgZXZlbnRzIGluIFdlYkdMQ29udGV4dC5cblx0ICpcblx0ICogTW9zdCB1c2VycyB3aWxsIHdhbnQgdG8gdXNlIHRoZSBBc3NldE1hbmFnZXIgdG8gY3JlYXRlIGFuZCBtYW5hZ2UgdGhlaXIgdGV4dHVyZXNcblx0ICogd2l0aCBhc3luY2hyb25vdXMgbG9hZGluZyBhbmQgY29udGV4dCBsb3NzLiBcblx0ICpcblx0ICogQGV4YW1wbGVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDI1NiwgMjU2KTsgLy9lbXB0eSAyNTZ4MjU2IHRleHR1cmVcblx0ICogXHRcdG5ldyBUZXh0dXJlKGNvbnRleHQsIDEsIDEsIFRleHR1cmUuRm9ybWF0LlJHQkEsIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSwgXG5cdCAqIFx0XHRcdFx0XHRuZXcgVWludDhBcnJheShbMjU1LDAsMCwyNTVdKSk7IC8vMXgxIHJlZCB0ZXh0dXJlXG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCBcInRlc3QucG5nXCIpOyAvL2xvYWRzIGltYWdlIGFzeW5jaHJvbm91c2x5XG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCBcInRlc3QucG5nXCIsIHN1Y2Nlc3NGdW5jLCBmYWlsRnVuYywgdXNlTWlwbWFwcyk7IC8vZXh0cmEgcGFyYW1zIGZvciBpbWFnZSBsYW9kZXIgXG5cdCAqXG5cdCAqIEBjbGFzcyAgVGV4dHVyZVxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7V2ViR0xDb250ZXh0fSBjb250ZXh0IHRoZSBXZWJHTCBjb250ZXh0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggdGhlIHdpZHRoIG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoaXMgdGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IGZvcm1hdCBlLmcuIFRleHR1cmUuRm9ybWF0LlJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhVHlwZSBlLmcuIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSAoVWludDhBcnJheSlcblx0ICogQHBhcmFtICB7R0xlbnVtfSBkYXRhIHRoZSBhcnJheSBidWZmZXIsIGUuZy4gYSBVaW50OEFycmF5IHZpZXdcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwcyB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBUZXh0dXJlXCI7XG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBXZWJHTFRleHR1cmUgd2hpY2ggYmFja3MgdGhpcyBUZXh0dXJlIG9iamVjdC4gVGhpc1xuXHRcdCAqIGNhbiBiZSB1c2VkIGZvciBsb3ctbGV2ZWwgR0wgY2FsbHMuXG5cdFx0ICogXG5cdFx0ICogQHR5cGUge1dlYkdMVGV4dHVyZX1cblx0XHQgKi9cblx0XHR0aGlzLmlkID0gbnVsbDsgLy9pbml0aWFsaXplZCBpbiBjcmVhdGUoKVxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHRhcmdldCBmb3IgdGhpcyB0ZXh0dXJlIHVuaXQsIGkuZS4gVEVYVFVSRV8yRC4gU3ViY2xhc3Nlc1xuXHRcdCAqIHNob3VsZCBvdmVycmlkZSB0aGUgY3JlYXRlKCkgbWV0aG9kIHRvIGNoYW5nZSB0aGlzLCBmb3IgY29ycmVjdFxuXHRcdCAqIHVzYWdlIHdpdGggY29udGV4dCByZXN0b3JlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB0YXJnZXRcblx0XHQgKiBAdHlwZSB7R0xlbnVtfVxuXHRcdCAqIEBkZWZhdWx0ICBnbC5URVhUVVJFXzJEXG5cdFx0ICovXG5cdFx0dGhpcy50YXJnZXQgPSBjb250ZXh0LmdsLlRFWFRVUkVfMkQ7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgd2lkdGggb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHdpZHRoXG5cdFx0ICogQHJlYWRPbmx5XG5cdFx0ICogQHR5cGUge051bWJlcn0gdGhlIHdpZHRoXG5cdFx0ICovXG5cdFx0dGhpcy53aWR0aCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlLCBpbiBwaXhlbHMuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IGhlaWdodFxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9IHRoZSBoZWlnaHRcblx0XHQgKi9cblx0XHR0aGlzLmhlaWdodCA9IDA7IC8vaW5pdGlhbGl6ZWQgb24gdGV4dHVyZSB1cGxvYWRcblxuXHRcdC8vIGUuZy4gLS0+IG5ldyBUZXh0dXJlKGdsLCAyNTYsIDI1NiwgZ2wuUkdCLCBnbC5VTlNJR05FRF9CWVRFLCBkYXRhKTtcblx0XHQvL1x0XHQgICAgICBjcmVhdGVzIGEgbmV3IGVtcHR5IHRleHR1cmUsIDI1NngyNTZcblx0XHQvL1x0XHQtLT4gbmV3IFRleHR1cmUoZ2wpO1xuXHRcdC8vXHRcdFx0ICBjcmVhdGVzIGEgbmV3IHRleHR1cmUgYnV0IFdJVEhPVVQgdXBsb2FkaW5nIGFueSBkYXRhLiBcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBTIHdyYXAgcGFyYW1ldGVyLlxuXHRcdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSB3cmFwU1xuXHRcdCAqL1xuXHRcdHRoaXMud3JhcFMgPSBUZXh0dXJlLkRFRkFVTFRfV1JBUDtcblx0XHQvKipcblx0XHQgKiBUaGUgVCB3cmFwIHBhcmFtZXRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gd3JhcFRcblx0XHQgKi9cblx0XHR0aGlzLndyYXBUID0gVGV4dHVyZS5ERUZBVUxUX1dSQVA7XG5cdFx0LyoqXG5cdFx0ICogVGhlIG1pbmlmY2F0aW9uIGZpbHRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gbWluRmlsdGVyIFxuXHRcdCAqL1xuXHRcdHRoaXMubWluRmlsdGVyID0gVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUjtcblx0XHRcblx0XHQvKipcblx0XHQgKiBUaGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXIuXG5cdFx0ICogQHByb3BlcnR5IHtHTGVudW19IG1hZ0ZpbHRlciBcblx0XHQgKi9cblx0XHR0aGlzLm1hZ0ZpbHRlciA9IFRleHR1cmUuREVGQVVMVF9GSUxURVI7XG5cblx0XHQvKipcblx0XHQgKiBXaGVuIGEgdGV4dHVyZSBpcyBjcmVhdGVkLCB3ZSBrZWVwIHRyYWNrIG9mIHRoZSBhcmd1bWVudHMgcHJvdmlkZWQgdG8gXG5cdFx0ICogaXRzIGNvbnN0cnVjdG9yLiBPbiBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUsIHRoZXNlIGFyZ3VtZW50cyBhcmUgcmUtc3VwcGxpZWRcblx0XHQgKiB0byB0aGUgVGV4dHVyZSwgc28gYXMgdG8gcmUtY3JlYXRlIGl0IGluIGl0cyBjb3JyZWN0IGZvcm0uXG5cdFx0ICpcblx0XHQgKiBUaGlzIGlzIG1haW5seSB1c2VmdWwgaWYgeW91IGFyZSBwcm9jZWR1cmFsbHkgY3JlYXRpbmcgdGV4dHVyZXMgYW5kIHBhc3Npbmdcblx0XHQgKiB0aGVpciBkYXRhIGRpcmVjdGx5IChlLmcuIGZvciBnZW5lcmljIGxvb2t1cCB0YWJsZXMgaW4gYSBzaGFkZXIpLiBGb3IgaW1hZ2Vcblx0XHQgKiBvciBtZWRpYSBiYXNlZCB0ZXh0dXJlcywgaXQgd291bGQgYmUgYmV0dGVyIHRvIHVzZSBhbiBBc3NldE1hbmFnZXIgdG8gbWFuYWdlXG5cdFx0ICogdGhlIGFzeW5jaHJvbm91cyB0ZXh0dXJlIHVwbG9hZC5cblx0XHQgKlxuXHRcdCAqIFVwb24gZGVzdHJveWluZyBhIHRleHR1cmUsIGEgcmVmZXJlbmNlIHRvIHRoaXMgaXMgYWxzbyBsb3N0LlxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IG1hbmFnZWRBcmdzXG5cdFx0ICogQHR5cGUge0FycmF5fSB0aGUgYXJyYXkgb2YgYXJndW1lbnRzLCBzaGlmdGVkIHRvIGV4Y2x1ZGUgdGhlIFdlYkdMQ29udGV4dCBwYXJhbWV0ZXJcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRBcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuXHRcdC8vVGhpcyBpcyBtYWFuZ2VkIGJ5IFdlYkdMQ29udGV4dFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMuY3JlYXRlKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgY2FuIGJlIGNhbGxlZCBhZnRlciBjcmVhdGluZyBhIFRleHR1cmUgdG8gbG9hZCBhbiBJbWFnZSBvYmplY3QgYXN5bmNocm9ub3VzbHksXG5cdCAqIG9yIHVwbG9hZCBpbWFnZSBkYXRhIGRpcmVjdGx5LiBJdCB0YWtlcyB0aGUgc2FtZSBwYXJhbWV0ZXJzIGFzIHRoZSBjb25zdHJ1Y3RvciwgZXhjZXB0IFxuXHQgKiBmb3IgdGhlIGNvbnRleHQgd2hpY2ggaGFzIGFscmVhZHkgYmVlbiBlc3RhYmxpc2hlZC4gXG5cdCAqXG5cdCAqIFVzZXJzIHdpbGwgZ2VuZXJhbGx5IG5vdCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS4gXG5cdCAqIFxuXHQgKiBAcHJvdGVjdGVkXG5cdCAqIEBtZXRob2QgIHNldHVwXG5cdCAqL1xuXHRzZXR1cDogZnVuY3Rpb24od2lkdGgsIGhlaWdodCwgZm9ybWF0LCBkYXRhVHlwZSwgZGF0YSwgZ2VuTWlwbWFwcykge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL0lmIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBhIHN0cmluZywgYXNzdW1lIGl0J3MgYW4gSW1hZ2UgbG9hZGVyXG5cdFx0Ly9zZWNvbmQgYXJndW1lbnQgd2lsbCB0aGVuIGJlIGdlbk1pcG1hcHMsIHRoaXJkIGFuZCBmb3VydGggdGhlIHN1Y2Nlc3MvZmFpbCBjYWxsYmFja3Ncblx0XHRpZiAodHlwZW9mIHdpZHRoID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHR2YXIgaW1nID0gbmV3IEltYWdlKCk7XG5cdFx0XHR2YXIgcGF0aCAgICAgID0gYXJndW1lbnRzWzBdOyAgIC8vZmlyc3QgYXJndW1lbnQsIHRoZSBwYXRoXG5cdFx0XHR2YXIgc3VjY2Vzc0NCID0gdHlwZW9mIGFyZ3VtZW50c1sxXSA9PT0gXCJmdW5jdGlvblwiID8gYXJndW1lbnRzWzFdIDogbnVsbDtcblx0XHRcdHZhciBmYWlsQ0IgICAgPSB0eXBlb2YgYXJndW1lbnRzWzJdID09PSBcImZ1bmN0aW9uXCIgPyBhcmd1bWVudHNbMl0gOiBudWxsO1xuXHRcdFx0Z2VuTWlwbWFwcyAgICA9ICEhYXJndW1lbnRzWzNdO1xuXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0XHRcdC8vSWYgeW91IHRyeSB0byByZW5kZXIgYSB0ZXh0dXJlIHRoYXQgaXMgbm90IHlldCBcInJlbmRlcmFibGVcIiAoaS5lLiB0aGUgXG5cdFx0XHQvL2FzeW5jIGxvYWQgaGFzbid0IGNvbXBsZXRlZCB5ZXQsIHdoaWNoIGlzIGFsd2F5cyB0aGUgY2FzZSBpbiBDaHJvbWUgc2luY2UgcmVxdWVzdEFuaW1hdGlvbkZyYW1lXG5cdFx0XHQvL2ZpcmVzIGJlZm9yZSBpbWcub25sb2FkKSwgV2ViR0wgd2lsbCB0aHJvdyB1cyBlcnJvcnMuIFNvIGluc3RlYWQgd2Ugd2lsbCBqdXN0IHVwbG9hZCBzb21lXG5cdFx0XHQvL2R1bW15IGRhdGEgdW50aWwgdGhlIHRleHR1cmUgbG9hZCBpcyBjb21wbGV0ZS4gVXNlcnMgY2FuIGRpc2FibGUgdGhpcyB3aXRoIHRoZSBnbG9iYWwgZmxhZy5cblx0XHRcdGlmIChUZXh0dXJlLlVTRV9EVU1NWV8xeDFfREFUQSkge1xuXHRcdFx0XHRzZWxmLnVwbG9hZERhdGEoMSwgMSk7XG5cdFx0XHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdFx0XHR9XG5cblx0XHRcdGltZy5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdFx0c2VsZi51cGxvYWRJbWFnZShpbWcsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBnZW5NaXBtYXBzKTtcblx0XHRcdFx0aWYgKHN1Y2Nlc3NDQilcblx0XHRcdFx0XHRzdWNjZXNzQ0IoKTtcblx0XHRcdH1cblx0XHRcdGltZy5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybihcIkVycm9yIGxvYWRpbmcgaW1hZ2U6IFwiK3BhdGgpO1xuXHRcdFx0XHRpZiAoZ2VuTWlwbWFwcykgLy93ZSBzdGlsbCBuZWVkIHRvIGdlbiBtaXBtYXBzIG9uIHRoZSAxeDEgZHVtbXlcblx0XHRcdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcChnbC5URVhUVVJFXzJEKTtcblx0XHRcdFx0aWYgKGZhaWxDQilcblx0XHRcdFx0XHRmYWlsQ0IoKTtcblx0XHRcdH1cblx0XHRcdGltZy5vbmFib3J0ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGNvbnNvbGUud2FybihcIkltYWdlIGxvYWQgYWJvcnRlZDogXCIrcGF0aCk7XG5cdFx0XHRcdGlmIChnZW5NaXBtYXBzKSAvL3dlIHN0aWxsIG5lZWQgdG8gZ2VuIG1pcG1hcHMgb24gdGhlIDF4MSBkdW1teVxuXHRcdFx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKGdsLlRFWFRVUkVfMkQpO1xuXHRcdFx0XHRpZiAoZmFpbENCKVxuXHRcdFx0XHRcdGZhaWxDQigpO1xuXHRcdFx0fVxuXG5cdFx0XHRpbWcuc3JjID0gcGF0aDtcblx0XHR9IFxuXHRcdC8vb3RoZXJ3aXNlIGFzc3VtZSBvdXIgcmVndWxhciBsaXN0IG9mIHdpZHRoL2hlaWdodCBhcmd1bWVudHMgYXJlIHBhc3NlZFxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy51cGxvYWREYXRhKHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpO1xuXHRcdH1cblx0fSxcdFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgaW4gdGhlIFRleHR1cmUgY29uc3RydWN0b3IsIGFuZCBhZnRlciB0aGUgR0wgY29udGV4dCBoYXMgYmVlbiByZS1pbml0aWFsaXplZC4gXG5cdCAqIFN1YmNsYXNzZXMgY2FuIG92ZXJyaWRlIHRoaXMgdG8gcHJvdmlkZSBhIGN1c3RvbSBkYXRhIHVwbG9hZCwgZS5nLiBjdWJlbWFwcyBvciBjb21wcmVzc2VkXG5cdCAqIHRleHR1cmVzLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBjcmVhdGVcblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDsgXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHRoaXMuaWQgPSBnbC5jcmVhdGVUZXh0dXJlKCk7IC8vdGV4dHVyZSBJRCBpcyByZWNyZWF0ZWRcblx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwOyAvL3NpemUgaXMgcmVzZXQgdG8gemVybyB1bnRpbCBsb2FkZWRcblx0XHR0aGlzLnRhcmdldCA9IGdsLlRFWFRVUkVfMkQ7ICAvL3RoZSBwcm92aWRlciBjYW4gY2hhbmdlIHRoaXMgaWYgbmVjZXNzYXJ5IChlLmcuIGN1YmUgbWFwcylcblxuXHRcdHRoaXMuYmluZCgpO1xuXG5cblx0XHQvL1RPRE86IGNsZWFuIHRoZXNlIHVwIGEgbGl0dGxlLiBcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEFfV0VCR0wsIFRleHR1cmUuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBKTtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQUxJR05NRU5ULCBUZXh0dXJlLlVOUEFDS19BTElHTk1FTlQpO1xuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIFRleHR1cmUuVU5QQUNLX0ZMSVBfWSk7XG5cdFx0XG5cdFx0dmFyIGNvbG9yc3BhY2UgPSBUZXh0dXJlLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT04gfHwgZ2wuQlJPV1NFUl9ERUZBVUxUX1dFQkdMO1xuXHRcdGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19DT0xPUlNQQUNFX0NPTlZFUlNJT05fV0VCR0wsIGNvbG9yc3BhY2UpO1xuXG5cdFx0Ly9zZXR1cCB3cmFwIG1vZGVzIHdpdGhvdXQgYmluZGluZyByZWR1bmRhbnRseVxuXHRcdHRoaXMuc2V0V3JhcCh0aGlzLndyYXBTLCB0aGlzLndyYXBULCBmYWxzZSk7XG5cdFx0dGhpcy5zZXRGaWx0ZXIodGhpcy5taW5GaWx0ZXIsIHRoaXMubWFnRmlsdGVyLCBmYWxzZSk7XG5cdFx0XG5cdFx0aWYgKHRoaXMubWFuYWdlZEFyZ3MubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHR0aGlzLnNldHVwLmFwcGx5KHRoaXMsIHRoaXMubWFuYWdlZEFyZ3MpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyB0ZXh0dXJlIGJ5IGRlbGV0aW5nIHRoZSBHTCByZXNvdXJjZSxcblx0ICogcmVtb3ZpbmcgaXQgZnJvbSB0aGUgV2ViR0xDb250ZXh0IG1hbmFnZW1lbnQgc3RhY2ssXG5cdCAqIHNldHRpbmcgaXRzIHNpemUgdG8gemVybywgYW5kIGlkIGFuZCBtYW5hZ2VkIGFyZ3VtZW50cyB0byBudWxsLlxuXHQgKiBcblx0ICogVHJ5aW5nIHRvIHVzZSB0aGlzIHRleHR1cmUgYWZ0ZXIgbWF5IGxlYWQgdG8gdW5kZWZpbmVkIGJlaGF2aW91ci5cblx0ICpcblx0ICogQG1ldGhvZCAgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMuaWQgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlVGV4dHVyZSh0aGlzLmlkKTtcblx0XHRpZiAodGhpcy5jb250ZXh0KVxuXHRcdFx0dGhpcy5jb250ZXh0LnJlbW92ZU1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy53aWR0aCA9IHRoaXMuaGVpZ2h0ID0gMDtcblx0XHR0aGlzLmlkID0gbnVsbDtcblx0XHR0aGlzLm1hbmFnZWRBcmdzID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSB3cmFwIG1vZGUgZm9yIHRoaXMgdGV4dHVyZTsgaWYgdGhlIHNlY29uZCBhcmd1bWVudFxuXHQgKiBpcyB1bmRlZmluZWQgb3IgZmFsc3ksIHRoZW4gYm90aCBTIGFuZCBUIHdyYXAgd2lsbCB1c2UgdGhlIGZpcnN0XG5cdCAqIGFyZ3VtZW50LlxuXHQgKlxuXHQgKiBZb3UgY2FuIHVzZSBUZXh0dXJlLldyYXAgY29uc3RhbnRzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgbmVlZGluZyBcblx0ICogYSBHTCByZWZlcmVuY2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldFdyYXBcblx0ICogQHBhcmFtIHtHTGVudW19IHMgdGhlIFMgd3JhcCBtb2RlXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSB0IHRoZSBUIHdyYXAgbW9kZVxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IGlnbm9yZUJpbmQgKG9wdGlvbmFsKSBpZiB0cnVlLCB0aGUgYmluZCB3aWxsIGJlIGlnbm9yZWQuIFxuXHQgKi9cblx0c2V0V3JhcDogZnVuY3Rpb24ocywgdCwgaWdub3JlQmluZCkgeyAvL1RPRE86IHN1cHBvcnQgUiB3cmFwIG1vZGVcblx0XHRpZiAocyAmJiB0KSB7XG5cdFx0XHR0aGlzLndyYXBTID0gcztcblx0XHRcdHRoaXMud3JhcFQgPSB0O1xuXHRcdH0gZWxzZSBcblx0XHRcdHRoaXMud3JhcFMgPSB0aGlzLndyYXBUID0gcztcblx0XHRcblx0XHQvL2VuZm9yY2UgUE9UIHJ1bGVzLi5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1x0XG5cblx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9XUkFQX1MsIHRoaXMud3JhcFMpO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9ULCB0aGlzLndyYXBUKTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBtaW4gYW5kIG1hZyBmaWx0ZXIgZm9yIHRoaXMgdGV4dHVyZTsgXG5cdCAqIGlmIG1hZyBpcyB1bmRlZmluZWQgb3IgZmFsc3ksIHRoZW4gYm90aCBtaW4gYW5kIG1hZyB3aWxsIHVzZSB0aGVcblx0ICogZmlsdGVyIHNwZWNpZmllZCBmb3IgbWluLlxuXHQgKlxuXHQgKiBZb3UgY2FuIHVzZSBUZXh0dXJlLkZpbHRlciBjb25zdGFudHMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCBuZWVkaW5nIFxuXHQgKiBhIEdMIHJlZmVyZW5jZS5cblx0ICpcblx0ICogQG1ldGhvZCAgc2V0RmlsdGVyXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBtaW4gdGhlIG1pbmlmaWNhdGlvbiBmaWx0ZXJcblx0ICogQHBhcmFtIHtHTGVudW19IG1hZyB0aGUgbWFnbmlmaWNhdGlvbiBmaWx0ZXJcblx0ICogQHBhcmFtIHtCb29sZWFufSBpZ25vcmVCaW5kIGlmIHRydWUsIHRoZSBiaW5kIHdpbGwgYmUgaWdub3JlZC4gXG5cdCAqL1xuXHRzZXRGaWx0ZXI6IGZ1bmN0aW9uKG1pbiwgbWFnLCBpZ25vcmVCaW5kKSB7IFxuXHRcdGlmIChtaW4gJiYgbWFnKSB7XG5cdFx0XHR0aGlzLm1pbkZpbHRlciA9IG1pbjtcblx0XHRcdHRoaXMubWFnRmlsdGVyID0gbWFnO1xuXHRcdH0gZWxzZSBcblx0XHRcdHRoaXMubWluRmlsdGVyID0gdGhpcy5tYWdGaWx0ZXIgPSBtaW47XG5cdFx0XG5cdFx0Ly9lbmZvcmNlIFBPVCBydWxlcy4uXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcblxuXHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdHRoaXMuYmluZCgpO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX01JTl9GSUxURVIsIHRoaXMubWluRmlsdGVyKTtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX01BR19GSUxURVIsIHRoaXMubWFnRmlsdGVyKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBsb3ctbGV2ZWwgbWV0aG9kIHRvIHVwbG9hZCB0aGUgc3BlY2lmaWVkIEFycmF5QnVmZmVyVmlld1xuXHQgKiB0byB0aGlzIHRleHR1cmUuIFRoaXMgd2lsbCBjYXVzZSB0aGUgd2lkdGggYW5kIGhlaWdodCBvZiB0aGlzXG5cdCAqIHRleHR1cmUgdG8gY2hhbmdlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICB1cGxvYWREYXRhXG5cdCAqIEBwYXJhbSAge051bWJlcn0gd2lkdGggICAgICAgICAgdGhlIG5ldyB3aWR0aCBvZiB0aGlzIHRleHR1cmUsXG5cdCAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHMgdG8gdGhlIGxhc3QgdXNlZCB3aWR0aCAob3IgemVybylcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgICAgICAgICB0aGUgbmV3IGhlaWdodCBvZiB0aGlzIHRleHR1cmVcblx0ICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0cyB0byB0aGUgbGFzdCB1c2VkIGhlaWdodCAob3IgemVybylcblx0ICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgICAgICAgICB0aGUgZGF0YSBmb3JtYXQsIGRlZmF1bHQgUkdCQVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IHR5cGUgICAgICAgICAgIHRoZSBkYXRhIHR5cGUsIGRlZmF1bHQgVU5TSUdORURfQllURSAoVWludDhBcnJheSlcblx0ICogQHBhcmFtICB7QXJyYXlCdWZmZXJWaWV3fSBkYXRhICB0aGUgcmF3IGRhdGEgZm9yIHRoaXMgdGV4dHVyZSwgb3IgbnVsbCBmb3IgYW4gZW1wdHkgaW1hZ2Vcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwc1x0ICAgd2hldGhlciB0byBnZW5lcmF0ZSBtaXBtYXBzIGFmdGVyIHVwbG9hZGluZyB0aGUgZGF0YSwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0dXBsb2FkRGF0YTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCwgZm9ybWF0LCB0eXBlLCBkYXRhLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGZvcm1hdCA9IGZvcm1hdCB8fCBnbC5SR0JBO1xuXHRcdHR5cGUgPSB0eXBlIHx8IGdsLlVOU0lHTkVEX0JZVEU7XG5cdFx0ZGF0YSA9IGRhdGEgfHwgbnVsbDsgLy9tYWtlIHN1cmUgZmFsc2V5IHZhbHVlIGlzIG51bGwgZm9yIHRleEltYWdlMkRcblxuXHRcdHRoaXMud2lkdGggPSAod2lkdGggfHwgd2lkdGg9PTApID8gd2lkdGggOiB0aGlzLndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gKGhlaWdodCB8fCBoZWlnaHQ9PTApID8gaGVpZ2h0IDogdGhpcy5oZWlnaHQ7XG5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1xuXG5cdFx0dGhpcy5iaW5kKCk7XG5cblx0XHRnbC50ZXhJbWFnZTJEKHRoaXMudGFyZ2V0LCAwLCBmb3JtYXQsIFxuXHRcdFx0XHRcdCAgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHQsIDAsIGZvcm1hdCxcblx0XHRcdFx0XHQgIHR5cGUsIGRhdGEpO1xuXG5cdFx0aWYgKGdlbk1pcG1hcHMpXG5cdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcCh0aGlzLnRhcmdldCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwbG9hZHMgSW1hZ2VEYXRhLCBIVE1MSW1hZ2VFbGVtZW50LCBIVE1MQ2FudmFzRWxlbWVudCBvciBcblx0ICogSFRNTFZpZGVvRWxlbWVudC5cblx0ICpcblx0ICogQG1ldGhvZCAgdXBsb2FkSW1hZ2Vcblx0ICogQHBhcmFtICB7T2JqZWN0fSBkb21PYmplY3QgdGhlIERPTSBpbWFnZSBjb250YWluZXJcblx0ICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgdGhlIGZvcm1hdCwgZGVmYXVsdCBnbC5SR0JBXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gdHlwZSB0aGUgZGF0YSB0eXBlLCBkZWZhdWx0IGdsLlVOU0lHTkVEX0JZVEVcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gZ2VuTWlwbWFwcyB3aGV0aGVyIHRvIGdlbmVyYXRlIG1pcG1hcHMgYWZ0ZXIgdXBsb2FkaW5nIHRoZSBkYXRhLCBkZWZhdWx0IGZhbHNlXG5cdCAqL1xuXHR1cGxvYWRJbWFnZTogZnVuY3Rpb24oZG9tT2JqZWN0LCBmb3JtYXQsIHR5cGUsIGdlbk1pcG1hcHMpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Zm9ybWF0ID0gZm9ybWF0IHx8IGdsLlJHQkE7XG5cdFx0dHlwZSA9IHR5cGUgfHwgZ2wuVU5TSUdORURfQllURTtcblx0XHRcblx0XHR0aGlzLndpZHRoID0gZG9tT2JqZWN0LndpZHRoO1xuXHRcdHRoaXMuaGVpZ2h0ID0gZG9tT2JqZWN0LmhlaWdodDtcblxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdGdsLnRleEltYWdlMkQodGhpcy50YXJnZXQsIDAsIGZvcm1hdCwgZm9ybWF0LFxuXHRcdFx0XHRcdCAgdHlwZSwgZG9tT2JqZWN0KTtcblxuXHRcdGlmIChnZW5NaXBtYXBzKVxuXHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAodGhpcy50YXJnZXQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBJZiBGT1JDRV9QT1QgaXMgZmFsc2UsIHdlIHZlcmlmeSB0aGlzIHRleHR1cmUgdG8gc2VlIGlmIGl0IGlzIHZhbGlkLCBcblx0ICogYXMgcGVyIG5vbi1wb3dlci1vZi10d28gcnVsZXMuIElmIGl0IGlzIG5vbi1wb3dlci1vZi10d28sIGl0IG11c3QgaGF2ZSBcblx0ICogYSB3cmFwIG1vZGUgb2YgQ0xBTVBfVE9fRURHRSwgYW5kIHRoZSBtaW5pZmljYXRpb24gZmlsdGVyIG11c3QgYmUgTElORUFSXG5cdCAqIG9yIE5FQVJFU1QuIElmIHdlIGRvbid0IHNhdGlzZnkgdGhlc2UgbmVlZHMsIGFuIGVycm9yIGlzIHRocm93bi5cblx0ICogXG5cdCAqIEBtZXRob2QgIF9jaGVja1BPVFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdF9jaGVja1BPVDogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCFUZXh0dXJlLkZPUkNFX1BPVCkge1xuXHRcdFx0Ly9JZiBtaW5GaWx0ZXIgaXMgYW55dGhpbmcgYnV0IExJTkVBUiBvciBORUFSRVNUXG5cdFx0XHQvL29yIGlmIHdyYXBTIG9yIHdyYXBUIGFyZSBub3QgQ0xBTVBfVE9fRURHRS4uLlxuXHRcdFx0dmFyIHdyb25nRmlsdGVyID0gKHRoaXMubWluRmlsdGVyICE9PSBUZXh0dXJlLkZpbHRlci5MSU5FQVIgJiYgdGhpcy5taW5GaWx0ZXIgIT09IFRleHR1cmUuRmlsdGVyLk5FQVJFU1QpO1xuXHRcdFx0dmFyIHdyb25nV3JhcCA9ICh0aGlzLndyYXBTICE9PSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRSB8fCB0aGlzLndyYXBUICE9PSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRSk7XG5cblx0XHRcdGlmICggd3JvbmdGaWx0ZXIgfHwgd3JvbmdXcmFwICkge1xuXHRcdFx0XHRpZiAoIWlzUG93ZXJPZlR3byh0aGlzLndpZHRoKSB8fCAhaXNQb3dlck9mVHdvKHRoaXMuaGVpZ2h0KSlcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3Iod3JvbmdGaWx0ZXIgXG5cdFx0XHRcdFx0XHRcdD8gXCJOb24tcG93ZXItb2YtdHdvIHRleHR1cmVzIGNhbm5vdCB1c2UgbWlwbWFwcGluZyBhcyBmaWx0ZXJcIlxuXHRcdFx0XHRcdFx0XHQ6IFwiTm9uLXBvd2VyLW9mLXR3byB0ZXh0dXJlcyBtdXN0IHVzZSBDTEFNUF9UT19FREdFIGFzIHdyYXBcIik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGUgdGV4dHVyZS4gSWYgdW5pdCBpcyBzcGVjaWZpZWQsXG5cdCAqIGl0IHdpbGwgYmluZCB0aGUgdGV4dHVyZSBhdCB0aGUgZ2l2ZW4gc2xvdFxuXHQgKiAoVEVYVFVSRTAsIFRFWFRVUkUxLCBldGMpLiBJZiB1bml0IGlzIG5vdCBzcGVjaWZpZWQsXG5cdCAqIGl0IHdpbGwgc2ltcGx5IGJpbmQgdGhlIHRleHR1cmUgYXQgd2hpY2hldmVyIHNsb3Rcblx0ICogaXMgY3VycmVudGx5IGFjdGl2ZS5cblx0ICpcblx0ICogQG1ldGhvZCAgYmluZFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHVuaXQgdGhlIHRleHR1cmUgdW5pdCBpbmRleCwgc3RhcnRpbmcgYXQgMFxuXHQgKi9cblx0YmluZDogZnVuY3Rpb24odW5pdCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0aWYgKHVuaXQgfHwgdW5pdCA9PT0gMClcblx0XHRcdGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTAgKyB1bml0KTtcblx0XHRnbC5iaW5kVGV4dHVyZSh0aGlzLnRhcmdldCwgdGhpcy5pZCk7XG5cdH0sXG5cblx0dG9TdHJpbmc6IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLmlkICsgXCI6XCIgKyB0aGlzLndpZHRoICsgXCJ4XCIgKyB0aGlzLmhlaWdodCArIFwiXCI7XG5cdH1cbn0pO1xuXG4vKiogXG4gKiBBIHNldCBvZiBGaWx0ZXIgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLkZpbHRlci5ORUFSRVNUXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVF9NSVBNQVBfTElORUFSXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVF9NSVBNQVBfTkVBUkVTVFxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUl9NSVBNQVBfTElORUFSXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTElORUFSX01JUE1BUF9ORUFSRVNUXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgRmlsdGVyXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLkZpbHRlciA9IHtcblx0TkVBUkVTVDogOTcyOCxcblx0TkVBUkVTVF9NSVBNQVBfTElORUFSOiA5OTg2LFxuXHRORUFSRVNUX01JUE1BUF9ORUFSRVNUOiA5OTg0LFxuXHRMSU5FQVI6IDk3MjksXG5cdExJTkVBUl9NSVBNQVBfTElORUFSOiA5OTg3LFxuXHRMSU5FQVJfTUlQTUFQX05FQVJFU1Q6IDk5ODVcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIFdyYXAgY29uc3RhbnRzIHRoYXQgbWF0Y2ggdGhlaXIgR0wgY291bnRlcnBhcnRzLlxuICogVGhpcyBpcyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIHRoZSBuZWVkIGZvciBhIEdMIHJlbmRlcmluZyBjb250ZXh0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqICAgICBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRVxuICogICAgIFRleHR1cmUuV3JhcC5NSVJST1JFRF9SRVBFQVRcbiAqICAgICBUZXh0dXJlLldyYXAuUkVQRUFUXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgV3JhcFxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5XcmFwID0ge1xuXHRDTEFNUF9UT19FREdFOiAzMzA3MSxcblx0TUlSUk9SRURfUkVQRUFUOiAzMzY0OCxcblx0UkVQRUFUOiAxMDQ5N1xufTtcblxuLyoqIFxuICogQSBzZXQgb2YgRm9ybWF0IGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5Gb3JtYXQuUkdCXG4gKiAgICAgVGV4dHVyZS5Gb3JtYXQuUkdCQVxuICogICAgIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRV9BTFBIQVxuICogYGBgXG4gKiBAYXR0cmlidXRlIEZvcm1hdFxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5Gb3JtYXQgPSB7XG5cdERFUFRIX0NPTVBPTkVOVDogNjQwMixcblx0QUxQSEE6IDY0MDYsXG5cdFJHQkE6IDY0MDgsXG5cdFJHQjogNjQwNyxcblx0TFVNSU5BTkNFOiA2NDA5LFxuXHRMVU1JTkFOQ0VfQUxQSEE6IDY0MTBcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIERhdGFUeXBlIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5EYXRhVHlwZS5VTlNJR05FRF9CWVRFIFxuICogICAgIFRleHR1cmUuRGF0YVR5cGUuRkxPQVQgXG4gKiBgYGBcbiAqIEBhdHRyaWJ1dGUgRGF0YVR5cGVcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuRGF0YVR5cGUgPSB7XG5cdEJZVEU6IDUxMjAsXG5cdFNIT1JUOiA1MTIyLFxuXHRJTlQ6IDUxMjQsXG5cdEZMT0FUOiA1MTI2LFxuXHRVTlNJR05FRF9CWVRFOiA1MTIxLFxuXHRVTlNJR05FRF9JTlQ6IDUxMjUsXG5cdFVOU0lHTkVEX1NIT1JUOiA1MTIzLFxuXHRVTlNJR05FRF9TSE9SVF80XzRfNF80OiAzMjgxOSxcblx0VU5TSUdORURfU0hPUlRfNV81XzVfMTogMzI4MjAsXG5cdFVOU0lHTkVEX1NIT1JUXzVfNl81OiAzMzYzNVxufVxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IHdyYXAgbW9kZSB3aGVuIGNyZWF0aW5nIG5ldyB0ZXh0dXJlcy4gSWYgYSBjdXN0b20gXG4gKiBwcm92aWRlciB3YXMgc3BlY2lmaWVkLCBpdCBtYXkgY2hvb3NlIHRvIG92ZXJyaWRlIHRoaXMgZGVmYXVsdCBtb2RlLlxuICogXG4gKiBAYXR0cmlidXRlIHtHTGVudW19IERFRkFVTFRfV1JBUFxuICogQHN0YXRpYyBcbiAqIEBkZWZhdWx0ICBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRVxuICovXG5UZXh0dXJlLkRFRkFVTFRfV1JBUCA9IFRleHR1cmUuV3JhcC5DTEFNUF9UT19FREdFO1xuXG5cbi8qKlxuICogVGhlIGRlZmF1bHQgZmlsdGVyIG1vZGUgd2hlbiBjcmVhdGluZyBuZXcgdGV4dHVyZXMuIElmIGEgY3VzdG9tXG4gKiBwcm92aWRlciB3YXMgc3BlY2lmaWVkLCBpdCBtYXkgY2hvb3NlIHRvIG92ZXJyaWRlIHRoaXMgZGVmYXVsdCBtb2RlLlxuICpcbiAqIEBhdHRyaWJ1dGUge0dMZW51bX0gREVGQVVMVF9GSUxURVJcbiAqIEBzdGF0aWNcbiAqIEBkZWZhdWx0ICBUZXh0dXJlLkZpbHRlci5MSU5FQVJcbiAqL1xuVGV4dHVyZS5ERUZBVUxUX0ZJTFRFUiA9IFRleHR1cmUuRmlsdGVyLk5FQVJFU1Q7XG5cbi8qKlxuICogQnkgZGVmYXVsdCwgd2UgZG8gc29tZSBlcnJvciBjaGVja2luZyB3aGVuIGNyZWF0aW5nIHRleHR1cmVzXG4gKiB0byBlbnN1cmUgdGhhdCB0aGV5IHdpbGwgYmUgXCJyZW5kZXJhYmxlXCIgYnkgV2ViR0wuIE5vbi1wb3dlci1vZi10d29cbiAqIHRleHR1cmVzIG11c3QgdXNlIENMQU1QX1RPX0VER0UgYXMgdGhlaXIgd3JhcCBtb2RlLCBhbmQgTkVBUkVTVCBvciBMSU5FQVJcbiAqIGFzIHRoZWlyIHdyYXAgbW9kZS4gRnVydGhlciwgdHJ5aW5nIHRvIGdlbmVyYXRlIG1pcG1hcHMgZm9yIGEgTlBPVCBpbWFnZVxuICogd2lsbCBsZWFkIHRvIGVycm9ycy4gXG4gKlxuICogSG93ZXZlciwgeW91IGNhbiBkaXNhYmxlIHRoaXMgZXJyb3IgY2hlY2tpbmcgYnkgc2V0dGluZyBgRk9SQ0VfUE9UYCB0byB0cnVlLlxuICogVGhpcyBtYXkgYmUgdXNlZnVsIGlmIHlvdSBhcmUgcnVubmluZyBvbiBzcGVjaWZpYyBoYXJkd2FyZSB0aGF0IHN1cHBvcnRzIFBPVCBcbiAqIHRleHR1cmVzLCBvciBpbiBzb21lIGZ1dHVyZSBjYXNlIHdoZXJlIE5QT1QgdGV4dHVyZXMgaXMgYWRkZWQgYXMgYSBXZWJHTCBleHRlbnNpb24uXG4gKiBcbiAqIEBhdHRyaWJ1dGUge0Jvb2xlYW59IEZPUkNFX1BPVFxuICogQHN0YXRpY1xuICogQGRlZmF1bHQgIGZhbHNlXG4gKi9cblRleHR1cmUuRk9SQ0VfUE9UID0gZmFsc2U7XG5cbi8vZGVmYXVsdCBwaXhlbCBzdG9yZSBvcGVyYXRpb25zLiBVc2VkIGluIGNyZWF0ZSgpXG5UZXh0dXJlLlVOUEFDS19GTElQX1kgPSBmYWxzZTtcblRleHR1cmUuVU5QQUNLX0FMSUdOTUVOVCA9IDE7XG5UZXh0dXJlLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQSA9IHRydWU7IFxuVGV4dHVyZS5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OID0gdW5kZWZpbmVkO1xuXG4vL2ZvciB0aGUgSW1hZ2UgY29uc3RydWN0b3Igd2UgbmVlZCB0byBoYW5kbGUgdGhpbmdzIGEgYml0IGRpZmZlcmVudGx5Li5cblRleHR1cmUuVVNFX0RVTU1ZXzF4MV9EQVRBID0gdHJ1ZTtcblxuLyoqXG4gKiBVdGlsaXR5IHRvIGdldCB0aGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgZm9yIHRoZSBnaXZlbiBHTGVudW0sIGUuZy4gZ2wuUkdCQSByZXR1cm5zIDQuXG4gKiBSZXR1cm5zIG51bGwgaWYgdGhlIHNwZWNpZmllZCBmb3JtYXQgaXMgbm90IG9mIHR5cGUgREVQVEhfQ09NUE9ORU5ULCBBTFBIQSwgTFVNSU5BTkNFLFxuICogTFVNSU5BTkNFX0FMUEhBLCBSR0IsIG9yIFJHQkEuXG4gKiBcbiAqIEBtZXRob2QgZ2V0TnVtQ29tcG9uZW50c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgYSB0ZXh0dXJlIGZvcm1hdCwgaS5lLiBUZXh0dXJlLkZvcm1hdC5SR0JBXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBudW1iZXIgb2YgY29tcG9uZW50cyBmb3IgdGhpcyBmb3JtYXRcbiAqL1xuVGV4dHVyZS5nZXROdW1Db21wb25lbnRzID0gZnVuY3Rpb24oZm9ybWF0KSB7XG5cdHN3aXRjaCAoZm9ybWF0KSB7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5ERVBUSF9DT01QT05FTlQ6XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5BTFBIQTpcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRTpcblx0XHRcdHJldHVybiAxO1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuTFVNSU5BTkNFX0FMUEhBOlxuXHRcdFx0cmV0dXJuIDI7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5SR0I6XG5cdFx0XHRyZXR1cm4gMztcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LlJHQkE6XG5cdFx0XHRyZXR1cm4gNDtcblx0fVxuXHRyZXR1cm4gbnVsbDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZTsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi9UZXh0dXJlJyk7XG5cbi8vVGhpcyBpcyBhIEdMLXNwZWNpZmljIHRleHR1cmUgcmVnaW9uLCBlbXBsb3lpbmcgdGFuZ2VudCBzcGFjZSBub3JtYWxpemVkIGNvb3JkaW5hdGVzIFUgYW5kIFYuXG4vL0EgY2FudmFzLXNwZWNpZmljIHJlZ2lvbiB3b3VsZCByZWFsbHkganVzdCBiZSBhIGxpZ2h0d2VpZ2h0IG9iamVjdCB3aXRoIHsgeCwgeSwgd2lkdGgsIGhlaWdodCB9XG4vL2luIHBpeGVscy5cbnZhciBUZXh0dXJlUmVnaW9uID0gbmV3IENsYXNzKHtcblxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBUZXh0dXJlUmVnaW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXHRcdHRoaXMuc2V0UmVnaW9uKHgsIHksIHdpZHRoLCBoZWlnaHQpO1xuXHR9LFxuXG5cdHNldFVWczogZnVuY3Rpb24odSwgdiwgdTIsIHYyKSB7XG5cdFx0dGhpcy5yZWdpb25XaWR0aCA9IE1hdGgucm91bmQoTWF0aC5hYnModTIgLSB1KSAqIHRoaXMudGV4dHVyZS53aWR0aCk7XG4gICAgICAgIHRoaXMucmVnaW9uSGVpZ2h0ID0gTWF0aC5yb3VuZChNYXRoLmFicyh2MiAtIHYpICogdGhpcy50ZXh0dXJlLmhlaWdodCk7XG5cbiAgICAgICAgLy8gRnJvbSBMaWJHRFggVGV4dHVyZVJlZ2lvbi5qYXZhIC0tIFxuXHRcdC8vIEZvciBhIDF4MSByZWdpb24sIGFkanVzdCBVVnMgdG93YXJkIHBpeGVsIGNlbnRlciB0byBhdm9pZCBmaWx0ZXJpbmcgYXJ0aWZhY3RzIG9uIEFNRCBHUFVzIHdoZW4gZHJhd2luZyB2ZXJ5IHN0cmV0Y2hlZC5cblx0XHRpZiAodGhpcy5yZWdpb25XaWR0aCA9PSAxICYmIHRoaXMucmVnaW9uSGVpZ2h0ID09IDEpIHtcblx0XHRcdHZhciBhZGp1c3RYID0gMC4yNSAvIHRoaXMudGV4dHVyZS53aWR0aDtcblx0XHRcdHUgKz0gYWRqdXN0WDtcblx0XHRcdHUyIC09IGFkanVzdFg7XG5cdFx0XHR2YXIgYWRqdXN0WSA9IDAuMjUgLyB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdFx0diArPSBhZGp1c3RZO1xuXHRcdFx0djIgLT0gYWRqdXN0WTtcblx0XHR9XG5cblx0XHR0aGlzLnUgPSB1O1xuXHRcdHRoaXMudiA9IHY7XG5cdFx0dGhpcy51MiA9IHUyO1xuXHRcdHRoaXMudjIgPSB2Mjtcblx0fSxcblxuXHRzZXRSZWdpb246IGZ1bmN0aW9uKHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR4ID0geCB8fCAwO1xuXHRcdHkgPSB5IHx8IDA7XG5cdFx0d2lkdGggPSAod2lkdGg9PT0wIHx8IHdpZHRoKSA/IHdpZHRoIDogdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdGhlaWdodCA9IChoZWlnaHQ9PT0wIHx8IGhlaWdodCkgPyBoZWlnaHQgOiB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXG5cdFx0dmFyIGludlRleFdpZHRoID0gMSAvIHRoaXMudGV4dHVyZS53aWR0aDtcblx0XHR2YXIgaW52VGV4SGVpZ2h0ID0gMSAvIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0dGhpcy5zZXRVVnMoeCAqIGludlRleFdpZHRoLCB5ICogaW52VGV4SGVpZ2h0LCAoeCArIHdpZHRoKSAqIGludlRleFdpZHRoLCAoeSArIGhlaWdodCkgKiBpbnZUZXhIZWlnaHQpO1xuXHRcdHRoaXMucmVnaW9uV2lkdGggPSBNYXRoLmFicyh3aWR0aCk7XG5cdFx0dGhpcy5yZWdpb25IZWlnaHQgPSBNYXRoLmFicyhoZWlnaHQpO1xuXHR9LFxuXG5cdC8qKiBTZXRzIHRoZSB0ZXh0dXJlIHRvIHRoYXQgb2YgdGhlIHNwZWNpZmllZCByZWdpb24gYW5kIHNldHMgdGhlIGNvb3JkaW5hdGVzIHJlbGF0aXZlIHRvIHRoZSBzcGVjaWZpZWQgcmVnaW9uLiAqL1xuXHRzZXRGcm9tUmVnaW9uOiBmdW5jdGlvbihyZWdpb24sIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLnRleHR1cmUgPSByZWdpb24udGV4dHVyZTtcblx0XHR0aGlzLnNldChyZWdpb24uZ2V0UmVnaW9uWCgpICsgeCwgcmVnaW9uLmdldFJlZ2lvblkoKSArIHksIHdpZHRoLCBoZWlnaHQpO1xuXHR9LFxuXG5cblx0Ly9UT0RPOiBhZGQgc2V0dGVycyBmb3IgcmVnaW9uWC9ZIGFuZCByZWdpb25XaWR0aC9IZWlnaHRcblxuXHRyZWdpb25YOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMudSAqIHRoaXMudGV4dHVyZS53aWR0aCk7XG5cdFx0fSBcblx0fSxcblxuXHRyZWdpb25ZOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMudiAqIHRoaXMudGV4dHVyZS5oZWlnaHQpO1xuXHRcdH1cblx0fSxcblxuXHRmbGlwOiBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIHRlbXA7XG5cdFx0aWYgKHgpIHtcblx0XHRcdHRlbXAgPSB0aGlzLnU7XG5cdFx0XHR0aGlzLnUgPSB0aGlzLnUyO1xuXHRcdFx0dGhpcy51MiA9IHRlbXA7XG5cdFx0fVxuXHRcdGlmICh5KSB7XG5cdFx0XHR0ZW1wID0gdGhpcy52O1xuXHRcdFx0dGhpcy52ID0gdGhpcy52Mjtcblx0XHRcdHRoaXMudjIgPSB0ZW1wO1xuXHRcdH1cblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZVJlZ2lvbjsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcblxuLyoqXG4gKiBBIHRoaW4gd3JhcHBlciBhcm91bmQgV2ViR0xSZW5kZXJpbmdDb250ZXh0IHdoaWNoIGhhbmRsZXNcbiAqIGNvbnRleHQgbG9zcyBhbmQgcmVzdG9yZSB3aXRoIHZhcmlvdXMgcmVuZGVyaW5nIG9iamVjdHMgKHRleHR1cmVzLFxuICogc2hhZGVycyBhbmQgYnVmZmVycykuIFRoaXMgYWxzbyBoYW5kbGVzIGdlbmVyYWwgdmlld3BvcnQgbWFuYWdlbWVudC5cbiAqXG4gKiBJZiB0aGUgdmlldyBpcyBub3Qgc3BlY2lmaWVkLCBhIGNhbnZhcyB3aWxsIGJlIGNyZWF0ZWQuXG4gKiBcbiAqIEBjbGFzcyAgV2ViR0xDb250ZXh0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aCB0aGUgd2lkdGggb2YgdGhlIEdMIGNhbnZhc1xuICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoZSBHTCBjYW52YXNcbiAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IHZpZXcgdGhlIG9wdGlvbmFsIERPTSBjYW52YXMgZWxlbWVudFxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRBdHRyaWJ1ZXRzIGFuIG9iamVjdCBjb250YWluaW5nIGNvbnRleHQgYXR0cmlicyB3aGljaFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgYmUgdXNlZCBkdXJpbmcgR0wgaW5pdGlhbGl6YXRpb25cbiAqL1xudmFyIFdlYkdMQ29udGV4dCA9IG5ldyBDbGFzcyh7XG5cdFxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBXZWJHTENvbnRleHQod2lkdGgsIGhlaWdodCwgdmlldywgY29udGV4dEF0dHJpYnV0ZXMpIHtcblx0XHQvKipcblx0XHQgKiBUaGUgbGlzdCBvZiByZW5kZXJpbmcgb2JqZWN0cyAoc2hhZGVycywgVkJPcywgdGV4dHVyZXMsIGV0Yykgd2hpY2ggYXJlIFxuXHRcdCAqIGN1cnJlbnRseSBiZWluZyBtYW5hZ2VkLiBBbnkgb2JqZWN0IHdpdGggYSBcImNyZWF0ZVwiIG1ldGhvZCBjYW4gYmUgYWRkZWRcblx0XHQgKiB0byB0aGlzIGxpc3QuIFVwb24gZGVzdHJveWluZyB0aGUgcmVuZGVyaW5nIG9iamVjdCwgaXQgc2hvdWxkIGJlIHJlbW92ZWQuXG5cdFx0ICogU2VlIGFkZE1hbmFnZWRPYmplY3QgYW5kIHJlbW92ZU1hbmFnZWRPYmplY3QuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtBcnJheX0gbWFuYWdlZE9iamVjdHNcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRPYmplY3RzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYWN0dWFsIEdMIGNvbnRleHQuIFlvdSBjYW4gdXNlIHRoaXMgZm9yXG5cdFx0ICogcmF3IEdMIGNhbGxzIG9yIHRvIGFjY2VzcyBHTGVudW0gY29uc3RhbnRzLiBUaGlzXG5cdFx0ICogd2lsbCBiZSB1cGRhdGVkIG9uIGNvbnRleHQgcmVzdG9yZS4gV2hpbGUgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIGlzIG5vdCBgdmFsaWRgLCB5b3Ugc2hvdWxkIG5vdCB0cnkgdG8gYWNjZXNzIEdMIHN0YXRlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBnbFxuXHRcdCAqIEB0eXBlIHtXZWJHTFJlbmRlcmluZ0NvbnRleHR9XG5cdFx0ICovXG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgY2FudmFzIERPTSBlbGVtZW50IGZvciB0aGlzIGNvbnRleHQuXG5cdFx0ICogQHByb3BlcnR5IHtOdW1iZXJ9IHZpZXdcblx0XHQgKi9cblx0XHR0aGlzLnZpZXcgPSB2aWV3IHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XG5cblx0XHQvL2RlZmF1bHQgc2l6ZSBhcyBwZXIgc3BlYzpcblx0XHQvL2h0dHA6Ly93d3cudzMub3JnL1RSLzIwMTIvV0QtaHRtbDUtYXV0aG9yLTIwMTIwMzI5L3RoZS1jYW52YXMtZWxlbWVudC5odG1sI3RoZS1jYW52YXMtZWxlbWVudFxuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFRoZSB3aWR0aCBvZiB0aGlzIGNhbnZhcy5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB3aWR0aFxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdFx0ICovXG5cdFx0dGhpcy53aWR0aCA9IHRoaXMudmlldy53aWR0aCA9IHdpZHRoIHx8IDMwMDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBoZWlnaHQgb2YgdGhpcyBjYW52YXMuXG5cdFx0ICogQHByb3BlcnR5IGhlaWdodFxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdFx0ICovXG5cdFx0dGhpcy5oZWlnaHQgPSB0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0IHx8IDE1MDtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGNvbnRleHQgYXR0cmlidXRlcyBmb3IgaW5pdGlhbGl6aW5nIHRoZSBHTCBzdGF0ZS4gVGhpcyBtaWdodCBpbmNsdWRlXG5cdFx0ICogYW50aS1hbGlhc2luZywgYWxwaGEgc2V0dGluZ3MsIHZlcmlzb24sIGFuZCBzbyBmb3J0aC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge09iamVjdH0gY29udGV4dEF0dHJpYnV0ZXMgXG5cdFx0ICovXG5cdFx0dGhpcy5jb250ZXh0QXR0cmlidXRlcyA9IGNvbnRleHRBdHRyaWJ1dGVzO1xuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdGhpcyBjb250ZXh0IGlzICd2YWxpZCcsIGkuZS4gcmVuZGVyYWJsZS4gQSBjb250ZXh0IHRoYXQgaGFzIGJlZW4gbG9zdFxuXHRcdCAqIChhbmQgbm90IHlldCByZXN0b3JlZCkgb3IgZGVzdHJveWVkIGlzIGludmFsaWQuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtCb29sZWFufSB2YWxpZFxuXHRcdCAqL1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgc2lnbmFsIGRpc3BhdGNoZWQgd2hlbiBHTCBjb250ZXh0IGlzIGxvc3QuIFxuXHRcdCAqIFxuXHRcdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIGlzIHRoZSBXZWJHTENvbnRleHRcblx0XHQgKiBtYW5hZ2luZyB0aGUgY29udGV4dCBsb3NzLlxuXHRcdCAqIFxuXHRcdCAqIEBldmVudCB7U2lnbmFsfSBsb3N0XG5cdFx0ICovXG5cdFx0dGhpcy5sb3N0ID0gbmV3IFNpZ25hbCgpO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCB3aGVuIEdMIGNvbnRleHQgaXMgcmVzdG9yZWQsIGFmdGVyIGFsbCB0aGUgbWFuYWdlZFxuXHRcdCAqIG9iamVjdHMgaGF2ZSBiZWVuIHJlY3JlYXRlZC5cblx0XHQgKlxuXHRcdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIGlzIHRoZSBXZWJHTENvbnRleHRcblx0XHQgKiB3aGljaCBtYW5hZ2VkIHRoZSByZXN0b3JhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFRoaXMgZG9lcyBub3QgZ2F1cmVudGVlIHRoYXQgYWxsIG9iamVjdHMgd2lsbCBiZSByZW5kZXJhYmxlLlxuXHRcdCAqIEZvciBleGFtcGxlLCBhIFRleHR1cmUgd2l0aCBhbiBJbWFnZVByb3ZpZGVyIG1heSBzdGlsbCBiZSBsb2FkaW5nXG5cdFx0ICogYXN5bmNocm9ub3VzbHkuXHQgXG5cdFx0ICogXG5cdFx0ICogQGV2ZW50IHtTaWduYWx9IHJlc3RvcmVkXG5cdFx0ICovXG5cdFx0dGhpcy5yZXN0b3JlZCA9IG5ldyBTaWduYWwoKTtcdFxuXHRcdFxuXHRcdC8vc2V0dXAgY29udGV4dCBsb3N0IGFuZCByZXN0b3JlIGxpc3RlbmVyc1xuXHRcdHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0bG9zdFwiLCBmdW5jdGlvbiAoZXYpIHtcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0TG9zdChldik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuX2NvbnRleHRSZXN0b3JlZChldik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcdFxuXHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHR0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cdFxuXHRfaW5pdENvbnRleHQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBlcnIgPSBcIlwiO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmdsID0gKHRoaXMudmlldy5nZXRDb250ZXh0KCd3ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpIFxuXHRcdFx0XHRcdFx0fHwgdGhpcy52aWV3LmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nbCkge1xuXHRcdFx0dGhpcy52YWxpZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IFwiV2ViR0wgQ29udGV4dCBOb3QgU3VwcG9ydGVkIC0tIHRyeSBlbmFibGluZyBpdCBvciB1c2luZyBhIGRpZmZlcmVudCBicm93c2VyXCI7XG5cdFx0fVx0XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhpcyBXZWJHTCBjb250ZXh0LCByZXNpemVzXG5cdCAqIHRoZSBjYW52YXMgdmlldywgYW5kIGNhbGxzIGdsLnZpZXdwb3J0KCkgd2l0aCB0aGUgbmV3IHNpemUuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICB0aGUgbmV3IHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0IHRoZSBuZXcgaGVpZ2h0XG5cdCAqL1xuXHRyZXNpemU6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHR0aGlzLnZpZXcud2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0O1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIChpbnRlcm5hbCB1c2UpXG5cdCAqIEEgbWFuYWdlZCBvYmplY3QgaXMgYW55dGhpbmcgd2l0aCBhIFwiY3JlYXRlXCIgZnVuY3Rpb24sIHRoYXQgd2lsbFxuXHQgKiByZXN0b3JlIEdMIHN0YXRlIGFmdGVyIGNvbnRleHQgbG9zcy4gXG5cdCAqIFxuXHQgKiBAcGFyYW0ge1t0eXBlXX0gdGV4IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGFkZE1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMucHVzaChvYmopO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiAoaW50ZXJuYWwgdXNlKVxuXHQgKiBSZW1vdmVzIGEgbWFuYWdlZCBvYmplY3QgZnJvbSB0aGUgY2FjaGUuIFRoaXMgaXMgdXNlZnVsIHRvIGRlc3Ryb3lcblx0ICogYSB0ZXh0dXJlIG9yIHNoYWRlciwgYW5kIGhhdmUgaXQgbm8gbG9uZ2VyIHJlLWxvYWQgb24gY29udGV4dCByZXN0b3JlLlxuXHQgKlxuXHQgKiBSZXR1cm5zIHRoZSBvYmplY3QgdGhhdCB3YXMgcmVtb3ZlZCwgb3IgbnVsbCBpZiBpdCB3YXMgbm90IGZvdW5kIGluIHRoZSBjYWNoZS5cblx0ICogXG5cdCAqIEBwYXJhbSAge09iamVjdH0gb2JqIHRoZSBvYmplY3QgdG8gYmUgbWFuYWdlZFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9ICAgICB0aGUgcmVtb3ZlZCBvYmplY3QsIG9yIG51bGxcblx0ICovXG5cdHJlbW92ZU1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHZhciBpZHggPSB0aGlzLm1hbmFnZWRPYmplY3RzLmluZGV4T2Yob2JqKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMubWFuYWdlZE9iamVjdHMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH0gXG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxzIGRlc3Ryb3koKSBvbiBlYWNoIG1hbmFnZWQgb2JqZWN0LCB0aGVuIHJlbW92ZXMgcmVmZXJlbmNlcyB0byB0aGVzZSBvYmplY3RzXG5cdCAqIGFuZCB0aGUgR0wgcmVuZGVyaW5nIGNvbnRleHQuIFRoaXMgYWxzbyByZW1vdmVzIHJlZmVyZW5jZXMgdG8gdGhlIHZpZXcgYW5kIHNldHNcblx0ICogdGhlIGNvbnRleHQncyB3aWR0aCBhbmQgaGVpZ2h0IHRvIHplcm8uXG5cdCAqXG5cdCAqIEF0dGVtcHRpbmcgdG8gdXNlIHRoaXMgV2ViR0xDb250ZXh0IG9yIHRoZSBHTCByZW5kZXJpbmcgY29udGV4dCBhZnRlciBkZXN0cm95aW5nIGl0XG5cdCAqIHdpbGwgbGVhZCB0byB1bmRlZmluZWQgYmVoYXZpb3VyLlxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBvYmogPSB0aGlzLm1hbmFnZWRPYmplY3RzW2ldO1xuXHRcdFx0aWYgKG9iaiAmJiB0eXBlb2Ygb2JqLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIilcblx0XHRcdFx0b2JqLmRlc3Ryb3koKTtcblx0XHR9XG5cdFx0dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGggPSAwO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR0aGlzLnZpZXcgPSBudWxsO1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdH0sXG5cblx0X2NvbnRleHRMb3N0OiBmdW5jdGlvbihldikge1xuXHRcdC8vYWxsIHRleHR1cmVzL3NoYWRlcnMvYnVmZmVycy9GQk9zIGhhdmUgYmVlbiBkZWxldGVkLi4uIFxuXHRcdC8vd2UgbmVlZCB0byByZS1jcmVhdGUgdGhlbSBvbiByZXN0b3JlXG5cdFx0dGhpcy52YWxpZCA9IGZhbHNlO1xuXG5cdFx0dGhpcy5sb3N0LmRpc3BhdGNoKHRoaXMpO1xuXHR9LFxuXG5cdF9jb250ZXh0UmVzdG9yZWQ6IGZ1bmN0aW9uKGV2KSB7XG5cdFx0Ly9maXJzdCwgaW5pdGlhbGl6ZSB0aGUgR0wgY29udGV4dCBhZ2FpblxuXHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHQvL25vdyB3ZSByZWNyZWF0ZSBvdXIgc2hhZGVycyBhbmQgdGV4dHVyZXNcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5tYW5hZ2VkT2JqZWN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy5tYW5hZ2VkT2JqZWN0c1tpXS5jcmVhdGUoKTtcblx0XHR9XG5cblx0XHQvL3VwZGF0ZSBHTCB2aWV3cG9ydFxuXHRcdHRoaXMucmVzaXplKHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0KTtcblxuXHRcdHRoaXMucmVzdG9yZWQuZGlzcGF0Y2godGhpcyk7XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdlYkdMQ29udGV4dDsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi4vVGV4dHVyZScpO1xuXG5cbnZhciBGcmFtZUJ1ZmZlciA9IG5ldyBDbGFzcyh7XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBuZXcgRnJhbWUgQnVmZmVyIE9iamVjdCB3aXRoIHRoZSBnaXZlbiB3aWR0aCBhbmQgaGVpZ2h0LlxuXHQgKlxuXHQgKiBJZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub24tbnVtYmVycywgdGhpcyBtZXRob2QgZXhwZWN0cyB0aGVcblx0ICogZmlyc3QgcGFyYW1ldGVyIHRvIGJlIGEgVGV4dHVyZSBvYmplY3Qgd2hpY2ggc2hvdWxkIGJlIGFjdGVkIHVwb24uIFxuXHQgKiBJbiB0aGlzIGNhc2UsIHRoZSBGcmFtZUJ1ZmZlciBkb2VzIG5vdCBcIm93blwiIHRoZSB0ZXh0dXJlLCBhbmQgc28gaXRcblx0ICogd29uJ3QgZGlzcG9zZSBvZiBpdCB1cG9uIGRlc3RydWN0aW9uLiBUaGlzIGlzIGFuIGFkdmFuY2VkIHZlcnNpb24gb2YgdGhlXG5cdCAqIGNvbnN0cnVjdG9yIHRoYXQgYXNzdW1lcyB0aGUgdXNlciBpcyBnaXZpbmcgdXMgYSB2YWxpZCBUZXh0dXJlIHRoYXQgY2FuIGJlIGJvdW5kIChpLmUuXG5cdCAqIG5vIGFzeW5jIEltYWdlIHRleHR1cmVzKS5cblx0ICpcblx0ICogQGNsYXNzICBGcmFtZUJ1ZmZlclxuXHQgKiBAY29uc3RydWN0b3Jcblx0ICogQHBhcmFtICB7W3R5cGVdfSB3aWR0aCAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGhlaWdodCBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gZmlsdGVyIFtkZXNjcmlwdGlvbl1cblx0ICogQHJldHVybiB7W3R5cGVdfSAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gRnJhbWVCdWZmZXIoY29udGV4dCwgd2lkdGgsIGhlaWdodCwgZm9ybWF0KSB7IC8vVE9ETzogZGVwdGggY29tcG9uZW50XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gRnJhbWVCdWZmZXJcIjtcblx0XG5cblx0XHQvKipcblx0XHQgKiBUaGUgdW5kZXJseWluZyBJRCBvZiB0aGUgR0wgZnJhbWUgYnVmZmVyIG9iamVjdC5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7V2ViR0xGcmFtZWJ1ZmZlcn0gaWRcblx0XHQgKi9cdFx0XG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgV2ViR0xDb250ZXh0IGJhY2tlZCBieSB0aGlzIGZyYW1lIGJ1ZmZlci5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7V2ViR0xDb250ZXh0fSBjb250ZXh0XG5cdFx0ICovXG5cdFx0dGhpcy5jb250ZXh0ID0gY29udGV4dDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBUZXh0dXJlIGJhY2tlZCBieSB0aGlzIGZyYW1lIGJ1ZmZlci5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gVGV4dHVyZVxuXHRcdCAqL1xuXHRcdC8vdGhpcyBUZXh0dXJlIGlzIG5vdyBtYW5hZ2VkLlxuXHRcdHRoaXMudGV4dHVyZSA9IG5ldyBUZXh0dXJlKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCk7XG5cblx0XHQvL1RoaXMgaXMgbWFhbmdlZCBieSBXZWJHTENvbnRleHRcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB3aGljaCByZXR1cm5zIHRoZSB3aWR0aCBvZiB0aGUgYmFja2luZyB0ZXh0dXJlLiBcblx0ICogXG5cdCAqIEByZWFkT25seVxuXHQgKiBAcHJvcGVydHkgd2lkdGhcblx0ICogQHR5cGUge051bWJlcn1cblx0ICovXG5cdHdpZHRoOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUud2lkdGhcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgcmVhZC1vbmx5IHByb3BlcnR5IHdoaWNoIHJldHVybnMgdGhlIGhlaWdodCBvZiB0aGUgYmFja2luZyB0ZXh0dXJlLiBcblx0ICogXG5cdCAqIEByZWFkT25seVxuXHQgKiBAcHJvcGVydHkgaGVpZ2h0XG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHRoZWlnaHQ6IHtcblx0XHRnZXQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0fVxuXHR9LFxuXG5cblx0LyoqXG5cdCAqIENhbGxlZCBkdXJpbmcgaW5pdGlhbGl6YXRpb24gdG8gc2V0dXAgdGhlIGZyYW1lIGJ1ZmZlcjsgYWxzbyBjYWxsZWQgb25cblx0ICogY29udGV4dCByZXN0b3JlLiBVc2VycyB3aWxsIG5vdCBuZWVkIHRvIGNhbGwgdGhpcyBkaXJlY3RseS5cblx0ICogXG5cdCAqIEBtZXRob2QgY3JlYXRlXG5cdCAqL1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR2YXIgdGV4ID0gdGhpcy50ZXh0dXJlO1xuXG5cdFx0Ly93ZSBhc3N1bWUgdGhlIHRleHR1cmUgaGFzIGFscmVhZHkgaGFkIGNyZWF0ZSgpIGNhbGxlZCBvbiBpdFxuXHRcdC8vc2luY2UgaXQgd2FzIGFkZGVkIGFzIGEgbWFuYWdlZCBvYmplY3QgcHJpb3IgdG8gdGhpcyBGcmFtZUJ1ZmZlclxuXHRcdHRleC5iaW5kKCk7XG4gXG5cdFx0dGhpcy5pZCA9IGdsLmNyZWF0ZUZyYW1lYnVmZmVyKCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCB0aGlzLmlkKTtcblxuXHRcdGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgdGV4LnRhcmdldCwgdGV4LmlkLCAwKTtcblxuXHRcdHZhciByZXN1bHQgPSBnbC5jaGVja0ZyYW1lYnVmZmVyU3RhdHVzKGdsLkZSQU1FQlVGRkVSKTtcblx0XHRpZiAocmVzdWx0ICE9IGdsLkZSQU1FQlVGRkVSX0NPTVBMRVRFKSB7XG5cdFx0XHR0aGlzLmRlc3Ryb3koKTsgLy9kZXN0cm95IG91ciByZXNvdXJjZXMgYmVmb3JlIGxlYXZpbmcgdGhpcyBmdW5jdGlvbi4uXG5cblx0XHRcdHZhciBlcnIgPSBcIkZyYW1lYnVmZmVyIG5vdCBjb21wbGV0ZVwiO1xuXHRcdFx0c3dpdGNoIChyZXN1bHQpIHtcblx0XHRcdFx0Y2FzZSBnbC5GUkFNRUJVRkZFUl9VTlNVUFBPUlRFRDpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IHVuc3VwcG9ydGVkXCIpO1xuXHRcdFx0XHRjYXNlIGdsLklOQ09NUExFVEVfRElNRU5TSU9OUzpcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyICsgXCI6IGluY29tcGxldGUgZGltZW5zaW9uc1wiKTtcblx0XHRcdFx0Y2FzZSBnbC5JTkNPTVBMRVRFX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBpbmNvbXBsZXRlIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGNhc2UgZ2wuSU5DT01QTEVURV9NSVNTSU5HX0FUVEFDSE1FTlQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBtaXNzaW5nIGF0dGFjaG1lbnRcIik7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG5cdH0sXG5cblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhpcyBmcmFtZSBidWZmZXIuIFVzaW5nIHRoaXMgb2JqZWN0IGFmdGVyIGRlc3Ryb3lpbmcgaXQgd2lsbCBoYXZlXG5cdCAqIHVuZGVmaW5lZCByZXN1bHRzLiBcblx0ICogQG1ldGhvZCBkZXN0cm95XG5cdCAqL1xuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSlcblx0XHRcdHRoaXMudGV4dHVyZS5kZXN0cm95KCk7XG5cdFx0aWYgKHRoaXMuaWQgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlRnJhbWVidWZmZXIodGhpcy5pZCk7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy50ZXh0dXJlID0gbnVsbDtcblx0XHR0aGlzLmNvbnRleHQgPSBudWxsO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGlzIGZyYW1lYnVmZmVyIGFuZCBzZXRzIHRoZSB2aWV3cG9ydCB0byB0aGUgZXhwZWN0ZWQgc2l6ZS5cblx0ICogQG1ldGhvZCBiZWdpblxuXHQgKi9cblx0YmVnaW46IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudmlld3BvcnQoMCwgMCwgdGhpcy50ZXh0dXJlLndpZHRoLCB0aGlzLnRleHR1cmUuaGVpZ2h0KTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHRoaXMuaWQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBCaW5kcyB0aGUgZGVmYXVsdCBmcmFtZSBidWZmZXIgKHRoZSBzY3JlZW4pIGFuZCBzZXRzIHRoZSB2aWV3cG9ydCBiYWNrXG5cdCAqIHRvIHRoZSBzaXplIG9mIHRoZSBXZWJHTENvbnRleHQuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnZpZXdwb3J0KDAsIDAsIHRoaXMuY29udGV4dC53aWR0aCwgdGhpcy5jb250ZXh0LmhlaWdodCk7XG5cdFx0Z2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCBudWxsKTtcblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRnJhbWVCdWZmZXI7IiwiLyoqXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxuLy9UT0RPOiBkZWNvdXBsZSBpbnRvIFZCTyArIElCTyB1dGlsaXRpZXMgXG4vKipcbiAqIEEgbWVzaCBjbGFzcyB0aGF0IHdyYXBzIFZCTyBhbmQgSUJPLlxuICpcbiAqIEBjbGFzcyAgTWVzaFxuICovXG52YXIgTWVzaCA9IG5ldyBDbGFzcyh7XG5cblxuXHQvKipcblx0ICogQSB3cml0ZS1vbmx5IHByb3BlcnR5IHdoaWNoIHNldHMgYm90aCB2ZXJ0aWNlcyBhbmQgaW5kaWNlcyBcblx0ICogZmxhZyB0byBkaXJ0eSBvciBub3QuIFxuXHQgKlxuXHQgKiBAcHJvcGVydHkgZGlydHlcblx0ICogQHR5cGUge0Jvb2xlYW59XG5cdCAqIEB3cml0ZU9ubHlcblx0ICovXG5cdGRpcnR5OiB7XG5cdFx0c2V0OiBmdW5jdGlvbih2YWwpIHtcblx0XHRcdHRoaXMudmVydGljZXNEaXJ0eSA9IHZhbDtcblx0XHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdmFsO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBNZXNoIHdpdGggdGhlIHByb3ZpZGVkIHBhcmFtZXRlcnMuXG5cdCAqXG5cdCAqIElmIG51bUluZGljZXMgaXMgMCBvciBmYWxzeSwgbm8gaW5kZXggYnVmZmVyIHdpbGwgYmUgdXNlZFxuXHQgKiBhbmQgaW5kaWNlcyB3aWxsIGJlIGFuIGVtcHR5IEFycmF5QnVmZmVyIGFuZCBhIG51bGwgaW5kZXhCdWZmZXIuXG5cdCAqIFxuXHQgKiBJZiBpc1N0YXRpYyBpcyB0cnVlLCB0aGVuIHZlcnRleFVzYWdlIGFuZCBpbmRleFVzYWdlIHdpbGxcblx0ICogYmUgc2V0IHRvIGdsLlNUQVRJQ19EUkFXLiBPdGhlcndpc2UgdGhleSB3aWxsIHVzZSBnbC5EWU5BTUlDX0RSQVcuXG5cdCAqIFlvdSBtYXkgd2FudCB0byBhZGp1c3QgdGhlc2UgYWZ0ZXIgaW5pdGlhbGl6YXRpb24gZm9yIGZ1cnRoZXIgY29udHJvbC5cblx0ICogXG5cdCAqIEBwYXJhbSAge1dlYkdMQ29udGV4dH0gIGNvbnRleHQgdGhlIGNvbnRleHQgZm9yIG1hbmFnZW1lbnRcblx0ICogQHBhcmFtICB7Qm9vbGVhbn0gaXNTdGF0aWMgICAgICBhIGhpbnQgYXMgdG8gd2hldGhlciB0aGlzIGdlb21ldHJ5IGlzIHN0YXRpY1xuXHQgKiBAcGFyYW0gIHtbdHlwZV19ICBudW1WZXJ0cyAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSAgbnVtSW5kaWNlcyAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gIHZlcnRleEF0dHJpYnMgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICAgICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIE1lc2goY29udGV4dCwgaXNTdGF0aWMsIG51bVZlcnRzLCBudW1JbmRpY2VzLCB2ZXJ0ZXhBdHRyaWJzKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gTWVzaFwiO1xuXHRcdGlmICghbnVtVmVydHMpXG5cdFx0XHR0aHJvdyBcIm51bVZlcnRzIG5vdCBzcGVjaWZpZWQsIG11c3QgYmUgPiAwXCI7XG5cblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdHRoaXMuZ2wgPSBjb250ZXh0LmdsO1xuXHRcdFxuXHRcdHRoaXMubnVtVmVydHMgPSBudWxsO1xuXHRcdHRoaXMubnVtSW5kaWNlcyA9IG51bGw7XG5cdFx0XG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG51bGw7XG5cdFx0dGhpcy5pbmRpY2VzID0gbnVsbDtcblx0XHR0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG5cdFx0dGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG5cblx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLmluZGV4VXNhZ2UgPSBudWxsO1xuXHRcdHRoaXMudmVydGV4VXNhZ2UgPSBudWxsO1xuXG5cdFx0LyoqIFxuXHRcdCAqIEBwcm9wZXJ0eVxuXHRcdCAqIEBwcml2YXRlXG5cdFx0ICovXG5cdFx0dGhpcy5fdmVydGV4QXR0cmlicyA9IG51bGw7XG5cblx0XHQvKiogXG5cdFx0ICogVGhlIHN0cmlkZSBmb3Igb25lIHZlcnRleCBfaW4gYnl0ZXNfLiBcblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge051bWJlcn0gdmVydGV4U3RyaWRlXG5cdFx0ICovXG5cdFx0dGhpcy52ZXJ0ZXhTdHJpZGUgPSBudWxsO1xuXG5cdFx0dGhpcy5udW1WZXJ0cyA9IG51bVZlcnRzO1xuXHRcdHRoaXMubnVtSW5kaWNlcyA9IG51bUluZGljZXMgfHwgMDtcblx0XHR0aGlzLnZlcnRleFVzYWdlID0gaXNTdGF0aWMgPyB0aGlzLmdsLlNUQVRJQ19EUkFXIDogdGhpcy5nbC5EWU5BTUlDX0RSQVc7XG5cdFx0dGhpcy5pbmRleFVzYWdlICA9IGlzU3RhdGljID8gdGhpcy5nbC5TVEFUSUNfRFJBVyA6IHRoaXMuZ2wuRFlOQU1JQ19EUkFXO1xuXHRcdHRoaXMuX3ZlcnRleEF0dHJpYnMgPSB2ZXJ0ZXhBdHRyaWJzIHx8IFtdO1xuXHRcdFxuXHRcdHRoaXMuaW5kaWNlc0RpcnR5ID0gdHJ1ZTtcblx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXG5cdFx0Ly9kZXRlcm1pbmUgdGhlIHZlcnRleCBzdHJpZGUgYmFzZWQgb24gZ2l2ZW4gYXR0cmlidXRlc1xuXHRcdHZhciB0b3RhbE51bUNvbXBvbmVudHMgPSAwO1xuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKVxuXHRcdFx0dG90YWxOdW1Db21wb25lbnRzICs9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV0ub2Zmc2V0Q291bnQ7XG5cdFx0dGhpcy52ZXJ0ZXhTdHJpZGUgPSB0b3RhbE51bUNvbXBvbmVudHMgKiA0OyAvLyBpbiBieXRlc1xuXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1WZXJ0cyk7XG5cdFx0dGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHRoaXMubnVtSW5kaWNlcyk7XG5cblx0XHQvL2FkZCB0aGlzIFZCTyB0byB0aGUgbWFuYWdlZCBjYWNoZVxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvL3JlY3JlYXRlcyB0aGUgYnVmZmVycyBvbiBjb250ZXh0IGxvc3Ncblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuXHRcdC8vaWdub3JlIGluZGV4IGJ1ZmZlciBpZiB3ZSBoYXZlbid0IHNwZWNpZmllZCBhbnlcblx0XHR0aGlzLmluZGV4QnVmZmVyID0gdGhpcy5udW1JbmRpY2VzID4gMFxuXHRcdFx0XHRcdD8gZ2wuY3JlYXRlQnVmZmVyKClcblx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0fSxcblxuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRpY2VzID0gbnVsbDtcblx0XHR0aGlzLmluZGljZXMgPSBudWxsO1xuXHRcdGlmICh0aGlzLnZlcnRleEJ1ZmZlciAmJiB0aGlzLmdsKVxuXHRcdFx0dGhpcy5nbC5kZWxldGVCdWZmZXIodGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXHRcdGlmICh0aGlzLmluZGV4QnVmZmVyICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLmluZGV4QnVmZmVyKTtcblx0XHR0aGlzLnZlcnRleEJ1ZmZlciA9IG51bGw7XG5cdFx0dGhpcy5pbmRleEJ1ZmZlciA9IG51bGw7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblx0X3VwZGF0ZUJ1ZmZlcnM6IGZ1bmN0aW9uKGlnbm9yZUJpbmQsIHN1YkRhdGFMZW5ndGgpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Ly9iaW5kIG91ciBpbmRleCBkYXRhLCBpZiB3ZSBoYXZlIGFueVxuXHRcdGlmICh0aGlzLm51bUluZGljZXMgPiAwKSB7XG5cdFx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHRcdGdsLmJpbmRCdWZmZXIoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kZXhCdWZmZXIpO1xuXG5cdFx0XHQvL3VwZGF0ZSB0aGUgaW5kZXggZGF0YVxuXHRcdFx0aWYgKHRoaXMuaW5kaWNlc0RpcnR5KSB7XG5cdFx0XHRcdGdsLmJ1ZmZlckRhdGEoZ2wuRUxFTUVOVF9BUlJBWV9CVUZGRVIsIHRoaXMuaW5kaWNlcywgdGhpcy5pbmRleFVzYWdlKTtcblx0XHRcdFx0dGhpcy5pbmRpY2VzRGlydHkgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvL2JpbmQgb3VyIHZlcnRleCBkYXRhXG5cdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRoaXMudmVydGV4QnVmZmVyKTtcblxuXHRcdC8vdXBkYXRlIG91ciB2ZXJ0ZXggZGF0YVxuXHRcdGlmICh0aGlzLnZlcnRpY2VzRGlydHkpIHtcblx0XHRcdGlmIChzdWJEYXRhTGVuZ3RoKSB7XG5cdFx0XHRcdC8vIFRPRE86IFdoZW4gZGVjb3VwbGluZyBWQk8vSUJPIGJlIHN1cmUgdG8gZ2l2ZSBiZXR0ZXIgc3ViRGF0YSBzdXBwb3J0Li5cblx0XHRcdFx0dmFyIHZpZXcgPSB0aGlzLnZlcnRpY2VzLnN1YmFycmF5KDAsIHN1YkRhdGFMZW5ndGgpO1xuXHRcdFx0XHRnbC5idWZmZXJTdWJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgMCwgdmlldyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0aWNlcywgdGhpcy52ZXJ0ZXhVc2FnZSk7XHRcblx0XHRcdH1cblxuXHRcdFx0XG5cdFx0XHR0aGlzLnZlcnRpY2VzRGlydHkgPSBmYWxzZTtcblx0XHR9XG5cdH0sXG5cblx0ZHJhdzogZnVuY3Rpb24ocHJpbWl0aXZlVHlwZSwgY291bnQsIG9mZnNldCwgc3ViRGF0YUxlbmd0aCkge1xuXHRcdGlmIChjb3VudCA9PT0gMClcblx0XHRcdHJldHVybjtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0XG5cdFx0b2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG5cblx0XHQvL2JpbmRzIGFuZCB1cGRhdGVzIG91ciBidWZmZXJzLiBwYXNzIGlnbm9yZUJpbmQgYXMgdHJ1ZVxuXHRcdC8vdG8gYXZvaWQgYmluZGluZyB1bm5lY2Vzc2FyaWx5XG5cdFx0dGhpcy5fdXBkYXRlQnVmZmVycyh0cnVlLCBzdWJEYXRhTGVuZ3RoKTtcblxuXHRcdGlmICh0aGlzLm51bUluZGljZXMgPiAwKSB7IFxuXHRcdFx0Z2wuZHJhd0VsZW1lbnRzKHByaW1pdGl2ZVR5cGUsIGNvdW50LCBcblx0XHRcdFx0XHRcdGdsLlVOU0lHTkVEX1NIT1JULCBvZmZzZXQgKiAyKTsgLy8qIFVpbnQxNkFycmF5LkJZVEVTX1BFUl9FTEVNRU5UXG5cdFx0fSBlbHNlXG5cdFx0XHRnbC5kcmF3QXJyYXlzKHByaW1pdGl2ZVR5cGUsIG9mZnNldCwgY291bnQpO1xuXHR9LFxuXG5cdC8vYmluZHMgdGhpcyBtZXNoJ3MgdmVydGV4IGF0dHJpYnV0ZXMgZm9yIHRoZSBnaXZlbiBzaGFkZXJcblx0YmluZDogZnVuY3Rpb24oc2hhZGVyKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBvZmZzZXQgPSAwO1xuXHRcdHZhciBzdHJpZGUgPSB0aGlzLnZlcnRleFN0cmlkZTtcblxuXHRcdC8vYmluZCBhbmQgdXBkYXRlIG91ciB2ZXJ0ZXggZGF0YSBiZWZvcmUgYmluZGluZyBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5fdXBkYXRlQnVmZmVycygpO1xuXG5cdFx0Ly9mb3IgZWFjaCBhdHRyaWJ0dWVcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGEgPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldO1xuXG5cdFx0XHQvL2xvY2F0aW9uIG9mIHRoZSBhdHRyaWJ1dGVcblx0XHRcdHZhciBsb2MgPSBhLmxvY2F0aW9uID09PSBudWxsIFxuXHRcdFx0XHRcdD8gc2hhZGVyLmdldEF0dHJpYnV0ZUxvY2F0aW9uKGEubmFtZSlcblx0XHRcdFx0XHQ6IGEubG9jYXRpb247XG5cblx0XHRcdC8vVE9ETzogV2UgbWF5IHdhbnQgdG8gc2tpcCB1bmZvdW5kIGF0dHJpYnNcblx0XHRcdC8vIGlmIChsb2MhPT0wICYmICFsb2MpXG5cdFx0XHQvLyBcdGNvbnNvbGUud2FybihcIldBUk46XCIsIGEubmFtZSwgXCJpcyBub3QgZW5hYmxlZFwiKTtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cblx0XHRcdC8vdGhlbiBzcGVjaWZ5IG91ciB2ZXJ0ZXggZm9ybWF0XG5cdFx0XHRnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgYS5udW1Db21wb25lbnRzLCBhLnR5cGUgfHwgZ2wuRkxPQVQsIFxuXHRcdFx0XHRcdFx0XHRcdCAgIGEubm9ybWFsaXplLCBzdHJpZGUsIG9mZnNldCk7XG5cblx0XHRcdC8vYW5kIGluY3JlYXNlIHRoZSBvZmZzZXQuLi5cblx0XHRcdG9mZnNldCArPSBhLm9mZnNldENvdW50ICogNDsgLy9pbiBieXRlc1xuXHRcdH1cblx0fSxcblxuXHR1bmJpbmQ6IGZ1bmN0aW9uKHNoYWRlcikge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL2ZvciBlYWNoIGF0dHJpYnR1ZVxuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgYSA9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV07XG5cblx0XHRcdC8vbG9jYXRpb24gb2YgdGhlIGF0dHJpYnV0ZVxuXHRcdFx0dmFyIGxvYyA9IGEubG9jYXRpb24gPT09IG51bGwgXG5cdFx0XHRcdFx0PyBzaGFkZXIuZ2V0QXR0cmlidXRlTG9jYXRpb24oYS5uYW1lKVxuXHRcdFx0XHRcdDogYS5sb2NhdGlvbjtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXHRcdH1cblx0fVxufSk7XG5cbk1lc2guQXR0cmliID0gbmV3IENsYXNzKHtcblxuXHRuYW1lOiBudWxsLFxuXHRudW1Db21wb25lbnRzOiBudWxsLFxuXHRsb2NhdGlvbjogbnVsbCxcblx0dHlwZTogbnVsbCxcblxuXHQvKipcblx0ICogTG9jYXRpb24gaXMgb3B0aW9uYWwgYW5kIGZvciBhZHZhbmNlZCB1c2VycyB0aGF0XG5cdCAqIHdhbnQgdmVydGV4IGFycmF5cyB0byBtYXRjaCBhY3Jvc3Mgc2hhZGVycy4gQW55IG5vbi1udW1lcmljYWxcblx0ICogdmFsdWUgd2lsbCBiZSBjb252ZXJ0ZWQgdG8gbnVsbCwgYW5kIGlnbm9yZWQuIElmIGEgbnVtZXJpY2FsXG5cdCAqIHZhbHVlIGlzIGdpdmVuLCBpdCB3aWxsIG92ZXJyaWRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIGF0dHJpYnV0ZVxuXHQgKiB3aGVuIGdpdmVuIHRvIGEgbWVzaC5cblx0ICogXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbmFtZSAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbnVtQ29tcG9uZW50cyBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbG9jYXRpb24gICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbihuYW1lLCBudW1Db21wb25lbnRzLCBsb2NhdGlvbiwgdHlwZSwgbm9ybWFsaXplLCBvZmZzZXRDb3VudCkge1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5udW1Db21wb25lbnRzID0gbnVtQ29tcG9uZW50cztcblx0XHR0aGlzLmxvY2F0aW9uID0gdHlwZW9mIGxvY2F0aW9uID09PSBcIm51bWJlclwiID8gbG9jYXRpb24gOiBudWxsO1xuXHRcdHRoaXMudHlwZSA9IHR5cGU7XG5cdFx0dGhpcy5ub3JtYWxpemUgPSBCb29sZWFuKG5vcm1hbGl6ZSk7XG5cdFx0dGhpcy5vZmZzZXRDb3VudCA9IHR5cGVvZiBvZmZzZXRDb3VudCA9PT0gXCJudW1iZXJcIiA/IG9mZnNldENvdW50IDogdGhpcy5udW1Db21wb25lbnRzO1xuXHR9XG59KVxuXG5cbm1vZHVsZS5leHBvcnRzID0gTWVzaDsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG5cbnZhciBTaGFkZXJQcm9ncmFtID0gbmV3IENsYXNzKHtcblx0XG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFNoYWRlclByb2dyYW0gZnJvbSB0aGUgZ2l2ZW4gc291cmNlLCBhbmQgYW4gb3B0aW9uYWwgbWFwIG9mIGF0dHJpYnV0ZVxuXHQgKiBsb2NhdGlvbnMgYXMgPG5hbWUsIGluZGV4PiBwYWlycy5cblx0ICpcblx0ICogX05vdGU6XyBDaHJvbWUgdmVyc2lvbiAzMSB3YXMgZ2l2aW5nIG1lIGlzc3VlcyB3aXRoIGF0dHJpYnV0ZSBsb2NhdGlvbnMgLS0geW91IG1heVxuXHQgKiB3YW50IHRvIG9taXQgdGhpcyB0byBsZXQgdGhlIGJyb3dzZXIgcGljayB0aGUgbG9jYXRpb25zIGZvciB5b3UuXHRcblx0ICpcblx0ICogQGNsYXNzICBTaGFkZXJQcm9ncmFtXG5cdCAqIEBjb25zdHJ1Y3RvclxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9IGNvbnRleHQgICAgICB0aGUgY29udGV4dCB0byBtYW5hZ2UgdGhpcyBvYmplY3Rcblx0ICogQHBhcmFtICB7U3RyaW5nfSB2ZXJ0U291cmNlICAgICAgICAgdGhlIHZlcnRleCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gZnJhZ1NvdXJjZSAgICAgICAgIHRoZSBmcmFnbWVudCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge09iamVjdH0gYXR0cmlidXRlTG9jYXRpb25zIHRoZSBhdHRyaWJ1dGUgbG9jYXRpb25zXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBTaGFkZXJQcm9ncmFtKGNvbnRleHQsIHZlcnRTb3VyY2UsIGZyYWdTb3VyY2UsIGF0dHJpYnV0ZUxvY2F0aW9ucykge1xuXHRcdGlmICghdmVydFNvdXJjZSB8fCAhZnJhZ1NvdXJjZSlcblx0XHRcdHRocm93IFwidmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzIG11c3QgYmUgZGVmaW5lZFwiO1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNoYWRlclByb2dyYW1cIjtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0dGhpcy52ZXJ0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSBudWxsO1xuXHRcdHRoaXMucHJvZ3JhbSA9IG51bGw7XG5cdFx0dGhpcy5sb2cgPSBcIlwiO1xuXG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMuYXR0cmlidXRlQ2FjaGUgPSBudWxsO1xuXG5cdFx0dGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMgPSBhdHRyaWJ1dGVMb2NhdGlvbnM7XG5cblx0XHQvL1dlIHRyaW0gKEVDTUFTY3JpcHQ1KSBzbyB0aGF0IHRoZSBHTFNMIGxpbmUgbnVtYmVycyBhcmVcblx0XHQvL2FjY3VyYXRlIG9uIHNoYWRlciBsb2dcblx0XHR0aGlzLnZlcnRTb3VyY2UgPSB2ZXJ0U291cmNlLnRyaW0oKTtcblx0XHR0aGlzLmZyYWdTb3VyY2UgPSBmcmFnU291cmNlLnRyaW0oKTtcblxuXHRcdC8vQWRkcyB0aGlzIHNoYWRlciB0byB0aGUgY29udGV4dCwgdG8gYmUgbWFuYWdlZFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKiogXG5cdCAqIFRoaXMgaXMgY2FsbGVkIGR1cmluZyB0aGUgU2hhZGVyUHJvZ3JhbSBjb25zdHJ1Y3Rvcixcblx0ICogYW5kIG1heSBuZWVkIHRvIGJlIGNhbGxlZCBhZ2FpbiBhZnRlciBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBjcmVhdGVcblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR0aGlzLl9jb21waWxlU2hhZGVycygpO1xuXHR9LFxuXG5cdC8vQ29tcGlsZXMgdGhlIHNoYWRlcnMsIHRocm93aW5nIGFuIGVycm9yIGlmIHRoZSBwcm9ncmFtIHdhcyBpbnZhbGlkLlxuXHRfY29tcGlsZVNoYWRlcnM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXHRcdFxuXHRcdHRoaXMubG9nID0gXCJcIjtcblxuXHRcdHRoaXMudmVydFNoYWRlciA9IHRoaXMuX2xvYWRTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUiwgdGhpcy52ZXJ0U291cmNlKTtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSB0aGlzLl9sb2FkU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUiwgdGhpcy5mcmFnU291cmNlKTtcblxuXHRcdGlmICghdGhpcy52ZXJ0U2hhZGVyIHx8ICF0aGlzLmZyYWdTaGFkZXIpXG5cdFx0XHR0aHJvdyBcIkVycm9yIHJldHVybmVkIHdoZW4gY2FsbGluZyBjcmVhdGVTaGFkZXJcIjtcblxuXHRcdHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcblxuXHRcdGdsLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMudmVydFNoYWRlcik7XG5cdFx0Z2wuYXR0YWNoU2hhZGVyKHRoaXMucHJvZ3JhbSwgdGhpcy5mcmFnU2hhZGVyKTtcblx0XG5cdFx0Ly9UT0RPOiBUaGlzIHNlZW1zIG5vdCB0byBiZSB3b3JraW5nIG9uIG15IE9TWCAtLSBtYXliZSBhIGRyaXZlciBidWc/XG5cdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRnbC5iaW5kQXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBNYXRoLmZsb29yKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zW2tleV0pLCBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Z2wubGlua1Byb2dyYW0odGhpcy5wcm9ncmFtKTsgXG5cblx0XHR0aGlzLmxvZyArPSBnbC5nZXRQcm9ncmFtSW5mb0xvZyh0aGlzLnByb2dyYW0pIHx8IFwiXCI7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRcdHRocm93IFwiRXJyb3IgbGlua2luZyB0aGUgc2hhZGVyIHByb2dyYW06XFxuXCJcblx0XHRcdFx0KyB0aGlzLmxvZztcblx0XHR9XG5cblx0XHR0aGlzLl9mZXRjaFVuaWZvcm1zKCk7XG5cdFx0dGhpcy5fZmV0Y2hBdHRyaWJ1dGVzKCk7XG5cdH0sXG5cblx0X2ZldGNoVW5pZm9ybXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuXHRcdGlmICghbGVuKSAvL251bGwgb3IgemVyb1xuXHRcdFx0cmV0dXJuO1xuXG5cdFx0Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgaW5mbyA9IGdsLmdldEFjdGl2ZVVuaWZvcm0odGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblx0XHRcdHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVuaWZvcm1DYWNoZVtuYW1lXSA9IHtcblx0XHRcdFx0c2l6ZTogaW5mby5zaXplLFxuXHRcdFx0XHR0eXBlOiBpbmZvLnR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvblxuXHRcdFx0fTtcblx0XHR9XG5cdH0sXG5cblx0X2ZldGNoQXR0cmlidXRlczogZnVuY3Rpb24oKSB7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG5cdFx0aWYgKCFsZW4pIC8vbnVsbCBvciB6ZXJvXG5cdFx0XHRyZXR1cm47XHRcblxuXHRcdGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0dmFyIGluZm8gPSBnbC5nZXRBY3RpdmVBdHRyaWIodGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblxuXHRcdFx0Ly90aGUgYXR0cmliIGxvY2F0aW9uIGlzIGEgc2ltcGxlIGluZGV4XG5cdFx0XHR2YXIgbG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlW25hbWVdID0ge1xuXHRcdFx0XHRzaXplOiBpbmZvLnNpemUsXG5cdFx0XHRcdHR5cGU6IGluZm8udHlwZSxcblx0XHRcdFx0bG9jYXRpb246IGxvY2F0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0fSxcblxuXHRfbG9hZFNoYWRlcjogZnVuY3Rpb24odHlwZSwgc291cmNlKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSk7XG5cdFx0aWYgKCFzaGFkZXIpIC8vc2hvdWxkIG5vdCBvY2N1ci4uLlxuXHRcdFx0cmV0dXJuIC0xO1xuXG5cdFx0Z2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcblx0XHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cdFx0XG5cdFx0dmFyIGxvZ1Jlc3VsdCA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSB8fCBcIlwiO1xuXHRcdGlmIChsb2dSZXN1bHQpIHtcblx0XHRcdC8vd2UgZG8gdGhpcyBzbyB0aGUgdXNlciBrbm93cyB3aGljaCBzaGFkZXIgaGFzIHRoZSBlcnJvclxuXHRcdFx0dmFyIHR5cGVTdHIgPSAodHlwZSA9PT0gZ2wuVkVSVEVYX1NIQURFUikgPyBcInZlcnRleFwiIDogXCJmcmFnbWVudFwiO1xuXHRcdFx0bG9nUmVzdWx0ID0gXCJFcnJvciBjb21waWxpbmcgXCIrIHR5cGVTdHIrIFwiIHNoYWRlcjpcXG5cIitsb2dSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2cgKz0gbG9nUmVzdWx0O1xuXG5cdFx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykgKSB7XG5cdFx0XHR0aHJvdyB0aGlzLmxvZztcblx0XHR9XG5cdFx0cmV0dXJuIHNoYWRlcjtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIHRvIGJpbmQgdGhpcyBzaGFkZXIuIE5vdGUgdGhhdCB0aGVyZSBpcyBubyBcInVuYmluZFwiIHNpbmNlXG5cdCAqIHRlY2huaWNhbGx5IHN1Y2ggYSB0aGluZyBpcyBub3QgcG9zc2libGUgaW4gdGhlIHByb2dyYW1tYWJsZSBwaXBlbGluZS5cblx0ICpcblx0ICogWW91IG11c3QgYmluZCBhIHNoYWRlciBiZWZvcmUgc2V0dGluZ3MgaXRzIHVuaWZvcm1zLlxuXHQgKiBcblx0ICogQG1ldGhvZCBiaW5kXG5cdCAqL1xuXHRiaW5kOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGlzIHNoYWRlciBhbmQgaXRzIHJlc291cmNlcy4gWW91IHNob3VsZCBub3QgdHJ5IHRvIHVzZSB0aGlzXG5cdCAqIGFmdGVyIGRlc3Ryb3lpbmcgaXQuXG5cdCAqIEBtZXRob2QgIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdGlmICh0aGlzLmdsKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdFx0Z2wuZGV0YWNoU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZXRhY2hTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblxuXHRcdFx0Z2wuZGVsZXRlU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblx0XHRcdGdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0XHR9XG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IG51bGw7XG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMudmVydFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLnByb2dyYW0gPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLCBpdCBpcyBhc3N1bWVkXG5cdCAqIHRvIG5vdCBleGlzdCwgYW5kIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogVGhpcyBtYXkgcmV0dXJuIG51bGwgZXZlbiBpZiB0aGUgdW5pZm9ybSBpcyBkZWZpbmVkIGluIEdMU0w6XG5cdCAqIGlmIGl0IGlzIF9pbmFjdGl2ZV8gKGkuZS4gbm90IHVzZWQgaW4gdGhlIHByb2dyYW0pIHRoZW4gaXQgbWF5XG5cdCAqIGJlIG9wdGltaXplZCBvdXQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFVuaWZvcm1JbmZvXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplLCBhbmQgdHlwZVxuXHQgKi9cblx0Z2V0VW5pZm9ybUluZm86IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy51bmlmb3JtQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCBhdHRyaWJ1dGUgaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgYXR0cmlidXRlIGlzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGl0IGlzIGFzc3VtZWRcblx0ICogdG8gbm90IGV4aXN0LCBhbmQgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBUaGlzIG1heSByZXR1cm4gbnVsbCBldmVuIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZGVmaW5lZCBpbiBHTFNMOlxuXHQgKiBpZiBpdCBpcyBfaW5hY3RpdmVfIChpLmUuIG5vdCB1c2VkIGluIHRoZSBwcm9ncmFtIG9yIGRpc2FibGVkKSBcblx0ICogdGhlbiBpdCBtYXkgYmUgb3B0aW1pemVkIG91dC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlSW5mb1xuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIGF0dHJpYnV0ZSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplIGFuZCB0eXBlXG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVJbmZvOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gbG9jYXRpb24gb2JqZWN0LlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQsIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlTG9jYXRpb25cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge0dMaW50fSB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVMb2NhdGlvbjogZnVuY3Rpb24obmFtZSkgeyAvL1RPRE86IG1ha2UgZmFzdGVyLCBkb24ndCBjYWNoZVxuXHRcdHZhciBpbmZvID0gdGhpcy5nZXRBdHRyaWJ1dGVJbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCB1bmlmb3JtIGxvY2F0aW9uIG9iamVjdCwgYXNzdW1pbmcgaXQgZXhpc3RzXG5cdCAqIGFuZCBpcyBhY3RpdmUuIE5vdGUgdGhhdCB1bmlmb3JtcyBtYXkgYmUgaW5hY3RpdmUgaWYgXG5cdCAqIHRoZSBHTFNMIGNvbXBpbGVyIGRlZW1lZCB0aGVtIHVudXNlZC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUxvY2F0aW9uXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtXZWJHTFVuaWZvcm1Mb2NhdGlvbn0gdGhlIGxvY2F0aW9uIG9iamVjdFxuXHQgKi9cblx0Z2V0VW5pZm9ybUxvY2F0aW9uOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGluZm8gPSB0aGlzLmdldFVuaWZvcm1JbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgdW5pZm9ybSBpcyBhY3RpdmUgYW5kIGZvdW5kIGluIHRoaXNcblx0ICogY29tcGlsZWQgcHJvZ3JhbS4gTm90ZSB0aGF0IHVuaWZvcm1zIG1heSBiZSBpbmFjdGl2ZSBpZiBcblx0ICogdGhlIEdMU0wgY29tcGlsZXIgZGVlbWVkIHRoZW0gdW51c2VkLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBoYXNVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgdGhlIHVuaWZvcm0gbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSB1bmlmb3JtIGlzIGZvdW5kIGFuZCBhY3RpdmVcblx0ICovXG5cdGhhc1VuaWZvcm06IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVbmlmb3JtSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgYWN0aXZlIGFuZCBmb3VuZCBpbiB0aGlzXG5cdCAqIGNvbXBpbGVkIHByb2dyYW0uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGhhc0F0dHJpYnV0ZVxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lIHRoZSBhdHRyaWJ1dGUgbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZm91bmQgYW5kIGFjdGl2ZVxuXHQgKi9cblx0aGFzQXR0cmlidXRlOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdW5pZm9ybSB2YWx1ZSBieSBuYW1lLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHthbnl9IFRoZSB2YWx1ZSBvZiB0aGUgV2ViR0wgdW5pZm9ybVxuXHQgKi9cblx0Z2V0VW5pZm9ybTogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdsLmdldFVuaWZvcm0odGhpcy5wcm9ncmFtLCB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHVuaWZvcm0gdmFsdWUgYXQgdGhlIHNwZWNpZmllZCBXZWJHTFVuaWZvcm1Mb2NhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUF0XG5cdCAqIEBwYXJhbSAge1dlYkdMVW5pZm9ybUxvY2F0aW9ufSBsb2NhdGlvbiB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqIEByZXR1cm4ge2FueX0gVGhlIHZhbHVlIG9mIHRoZSBXZWJHTCB1bmlmb3JtXG5cdCAqL1xuXHRnZXRVbmlmb3JtQXQ6IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2wuZ2V0VW5pZm9ybSh0aGlzLnByb2dyYW0sIGxvY2F0aW9uKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1pIGZyb20gdGhlIGdpdmVuIGFyZ3VtZW50cy5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50c1xuXHQgKiBwYXNzZWQuIEZvciBleGFtcGxlLCBgc2V0VW5pZm9ybWkoXCJ2YXJcIiwgMCwgMSlgIG1hcHMgdG8gYGdsLnVuaWZvcm0yaWAuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHggIHRoZSB4IGNvbXBvbmVudCBmb3IgaW50c1xuXHQgKiBAcGFyYW0ge0dMaW50fSB5ICB0aGUgeSBjb21wb25lbnQgZm9yIGl2ZWMyXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgaXZlYzNcblx0ICogQHBhcmFtIHtHTGludH0gdyAgdGhlIHcgY29tcG9uZW50IGZvciBpdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWk6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xaShsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJpKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2kobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00aShsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWlcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIG1ldGhvZCB0byBzZXQgdW5pZm9ybWYgZnJvbSB0aGUgZ2l2ZW4gYXJndW1lbnRzLlxuXHQgKiBXZSBkZXRlcm1pbmUgd2hpY2ggR0wgY2FsbCB0byBtYWtlIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzXG5cdCAqIHBhc3NlZC4gRm9yIGV4YW1wbGUsIGBzZXRVbmlmb3JtZihcInZhclwiLCAwLCAxKWAgbWFwcyB0byBgZ2wudW5pZm9ybTJmYC5cblx0ICogXG5cdCAqIEBtZXRob2QgIHNldFVuaWZvcm1mXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgICAgICBcdFx0dGhlIG5hbWUgb2YgdGhlIHVuaWZvcm1cblx0ICogQHBhcmFtIHtHTGZsb2F0fSB4ICB0aGUgeCBjb21wb25lbnQgZm9yIGZsb2F0c1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHkgIHRoZSB5IGNvbXBvbmVudCBmb3IgdmVjMlxuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgdmVjM1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHcgIHRoZSB3IGNvbXBvbmVudCBmb3IgdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWY6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xZihsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJmKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2YobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00Zihsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8vSSBndWVzcyB3ZSB3b24ndCBzdXBwb3J0IHNlcXVlbmNlPEdMZmxvYXQ+IC4uIHdoYXRldmVyIHRoYXQgaXMgPz9cblx0XG5cblx0Ly8vLy8gXG5cdFxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OZnYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBGbG9hdDMyQXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtZnZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIHZlYzJcblx0ICovXG5cdHNldFVuaWZvcm1mdjogZnVuY3Rpb24obmFtZSwgYXJyYXlCdWZmZXIsIGNvdW50KSB7XG5cdFx0Y291bnQgPSBjb3VudCB8fCBhcnJheUJ1ZmZlci5sZW5ndGg7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR2YXIgbG9jID0gdGhpcy5nZXRVbmlmb3JtTG9jYXRpb24obmFtZSk7XG5cdFx0aWYgKCFsb2MpIFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdGNhc2UgMTogZ2wudW5pZm9ybTFmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0yZnYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtM2Z2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTRmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OaXYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBpbnQgYXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaXZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIGl2ZWMyXG5cdCAqL1xuXHRzZXRVbmlmb3JtaXY6IGZ1bmN0aW9uKG5hbWUsIGFycmF5QnVmZmVyLCBjb3VudCkge1xuXHRcdGNvdW50ID0gY291bnQgfHwgYXJyYXlCdWZmZXIubGVuZ3RoO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmICghbG9jKSBcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRzd2l0Y2ggKGNvdW50KSB7XG5cdFx0XHRjYXNlIDE6IGdsLnVuaWZvcm0xaXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAyOiBnbC51bmlmb3JtMml2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTNpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDQ6IGdsLnVuaWZvcm00aXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgXCJpbnZhbGlkIGFyZ3VtZW50cyB0byBzZXRVbmlmb3JtZlwiOyBcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiB0byBwYXNzIGEgTWF0cml4MyAoZnJvbSB2ZWNtYXRoLFxuXHQgKiBrYW1pJ3MgcHJlZmVycmVkIG1hdGggbGlicmFyeSkgb3IgYSBGbG9hdDMyQXJyYXkgKGUuZy4gZ2wtbWF0cml4KVxuXHQgKiB0byBhIHNoYWRlci4gSWYgbWF0IGlzIGFuIG9iamVjdCB3aXRoIFwidmFsXCIsIGl0IGlzIGNvbnNpZGVyZWQgdG8gYmVcblx0ICogYSBNYXRyaXgzLCBvdGhlcndpc2UgYXNzdW1lZCB0byBiZSBhIHR5cGVkIGFycmF5IGJlaW5nIHBhc3NlZCBkaXJlY3RseVxuXHQgKiB0byB0aGUgc2hhZGVyLlxuXHQgKiBcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgdGhlIHVuaWZvcm0gbmFtZVxuXHQgKiBAcGFyYW0ge01hdHJpeDN8RmxvYXQzMkFycmF5fSBtYXQgYSBNYXRyaXgzIG9yIEZsb2F0MzJBcnJheVxuXHQgKiBAcGFyYW0ge0Jvb2xlYW59IHRyYW5zcG9zZSB3aGV0aGVyIHRvIHRyYW5zcG9zZSB0aGUgbWF0cml4LCBkZWZhdWx0IGZhbHNlXG5cdCAqL1xuXHRzZXRVbmlmb3JtTWF0cml4MzogZnVuY3Rpb24obmFtZSwgbWF0LCB0cmFuc3Bvc2UpIHtcblx0XHR2YXIgYXJyID0gdHlwZW9mIG1hdCA9PT0gXCJvYmplY3RcIiAmJiBtYXQudmFsID8gbWF0LnZhbCA6IG1hdDtcblx0XHR0cmFuc3Bvc2UgPSAhIXRyYW5zcG9zZTsgLy90byBib29sZWFuXG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0Z2wudW5pZm9ybU1hdHJpeDNmdihsb2MsIHRyYW5zcG9zZSwgYXJyKVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgZnVuY3Rpb24gdG8gcGFzcyBhIE1hdHJpeDQgKGZyb20gdmVjbWF0aCxcblx0ICoga2FtaSdzIHByZWZlcnJlZCBtYXRoIGxpYnJhcnkpIG9yIGEgRmxvYXQzMkFycmF5IChlLmcuIGdsLW1hdHJpeClcblx0ICogdG8gYSBzaGFkZXIuIElmIG1hdCBpcyBhbiBvYmplY3Qgd2l0aCBcInZhbFwiLCBpdCBpcyBjb25zaWRlcmVkIHRvIGJlXG5cdCAqIGEgTWF0cml4NCwgb3RoZXJ3aXNlIGFzc3VtZWQgdG8gYmUgYSB0eXBlZCBhcnJheSBiZWluZyBwYXNzZWQgZGlyZWN0bHlcblx0ICogdG8gdGhlIHNoYWRlci5cblx0ICogXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWVcblx0ICogQHBhcmFtIHtNYXRyaXg0fEZsb2F0MzJBcnJheX0gbWF0IGEgTWF0cml4NCBvciBGbG9hdDMyQXJyYXlcblx0ICogQHBhcmFtIHtCb29sZWFufSB0cmFuc3Bvc2Ugd2hldGhlciB0byB0cmFuc3Bvc2UgdGhlIG1hdHJpeCwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0c2V0VW5pZm9ybU1hdHJpeDQ6IGZ1bmN0aW9uKG5hbWUsIG1hdCwgdHJhbnNwb3NlKSB7XG5cdFx0dmFyIGFyciA9IHR5cGVvZiBtYXQgPT09IFwib2JqZWN0XCIgJiYgbWF0LnZhbCA/IG1hdC52YWwgOiBtYXQ7XG5cdFx0dHJhbnNwb3NlID0gISF0cmFuc3Bvc2U7IC8vdG8gYm9vbGVhblxuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR2YXIgbG9jID0gdGhpcy5nZXRVbmlmb3JtTG9jYXRpb24obmFtZSk7XG5cdFx0aWYgKCFsb2MpIFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGdsLnVuaWZvcm1NYXRyaXg0ZnYobG9jLCB0cmFuc3Bvc2UsIGFycilcblx0fSBcbiBcbn0pO1xuXG4vL1NvbWUgZGVmYXVsdCBhdHRyaWJ1dGUgbmFtZXMgdGhhdCBwYXJ0cyBvZiBrYW1pIHdpbGwgdXNlXG4vL3doZW4gY3JlYXRpbmcgYSBzdGFuZGFyZCBzaGFkZXIuXG5TaGFkZXJQcm9ncmFtLlBPU0lUSU9OX0FUVFJJQlVURSA9IFwiUG9zaXRpb25cIjtcblNoYWRlclByb2dyYW0uTk9STUFMX0FUVFJJQlVURSA9IFwiTm9ybWFsXCI7XG5TaGFkZXJQcm9ncmFtLkNPTE9SX0FUVFJJQlVURSA9IFwiQ29sb3JcIjtcblNoYWRlclByb2dyYW0uVEVYQ09PUkRfQVRUUklCVVRFID0gXCJUZXhDb29yZFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYWRlclByb2dyYW07IiwiLyoqXG4gIEF1dG8tZ2VuZXJhdGVkIEthbWkgaW5kZXggZmlsZS5cbiAgQ3JlYXRlZCBvbiAyMDE0LTAzLTAyLlxuKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8vY29yZSBjbGFzc2VzXG4gICAgJ0Jhc2VCYXRjaCc6ICAgICAgIHJlcXVpcmUoJy4vQmFzZUJhdGNoLmpzJyksXG4gICAgJ1Nwcml0ZUJhdGNoJzogICAgIHJlcXVpcmUoJy4vU3ByaXRlQmF0Y2guanMnKSxcbiAgICAnVGV4dHVyZSc6ICAgICAgICAgcmVxdWlyZSgnLi9UZXh0dXJlLmpzJyksXG4gICAgJ1RleHR1cmVSZWdpb24nOiAgIHJlcXVpcmUoJy4vVGV4dHVyZVJlZ2lvbi5qcycpLFxuICAgICdXZWJHTENvbnRleHQnOiAgICByZXF1aXJlKCcuL1dlYkdMQ29udGV4dC5qcycpLFxuICAgICdGcmFtZUJ1ZmZlcic6ICAgICByZXF1aXJlKCcuL2dsdXRpbHMvRnJhbWVCdWZmZXIuanMnKSxcbiAgICAnTWVzaCc6ICAgICAgICAgICAgcmVxdWlyZSgnLi9nbHV0aWxzL01lc2guanMnKSxcbiAgICAnU2hhZGVyUHJvZ3JhbSc6ICAgcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMnKVxufTsiLCJ2YXIgaW50OCA9IG5ldyBJbnQ4QXJyYXkoNCk7XG52YXIgaW50MzIgPSBuZXcgSW50MzJBcnJheShpbnQ4LmJ1ZmZlciwgMCwgMSk7XG52YXIgZmxvYXQzMiA9IG5ldyBGbG9hdDMyQXJyYXkoaW50OC5idWZmZXIsIDAsIDEpO1xuXG4vKipcbiAqIEEgc2luZ2xldG9uIGZvciBudW1iZXIgdXRpbGl0aWVzLiBcbiAqIEBjbGFzcyBOdW1iZXJVdGlsXG4gKi9cbnZhciBOdW1iZXJVdGlsID0gZnVuY3Rpb24oKSB7XG5cbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgZmxvYXQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGludCBiaXRzLiBBcnJheUJ1ZmZlclxuICogaXMgdXNlZCBmb3IgdGhlIGNvbnZlcnNpb24uXG4gKlxuICogQG1ldGhvZCAgaW50Qml0c1RvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSAge051bWJlcn0gaSB0aGUgaW50IHRvIGNhc3RcbiAqIEByZXR1cm4ge051bWJlcn0gICB0aGUgZmxvYXRcbiAqL1xuTnVtYmVyVXRpbC5pbnRCaXRzVG9GbG9hdCA9IGZ1bmN0aW9uKGkpIHtcblx0aW50MzJbMF0gPSBpO1xuXHRyZXR1cm4gZmxvYXQzMlswXTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgaW50IGJpdHMgZnJvbSB0aGUgZ2l2ZW4gZmxvYXQuIEFycmF5QnVmZmVyIGlzIHVzZWRcbiAqIGZvciB0aGUgY29udmVyc2lvbi5cbiAqXG4gKiBAbWV0aG9kICBmbG9hdFRvSW50Qml0c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7TnVtYmVyfSBmIHRoZSBmbG9hdCB0byBjYXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIGludCBiaXRzXG4gKi9cbk51bWJlclV0aWwuZmxvYXRUb0ludEJpdHMgPSBmdW5jdGlvbihmKSB7XG5cdGZsb2F0MzJbMF0gPSBmO1xuXHRyZXR1cm4gaW50MzJbMF07XG59O1xuXG4vKipcbiAqIEVuY29kZXMgQUJHUiBpbnQgYXMgYSBmbG9hdCwgd2l0aCBzbGlnaHQgcHJlY2lzaW9uIGxvc3MuXG4gKlxuICogQG1ldGhvZCAgaW50VG9GbG9hdENvbG9yXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgYW4gQUJHUiBwYWNrZWQgaW50ZWdlclxuICovXG5OdW1iZXJVdGlsLmludFRvRmxvYXRDb2xvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHJldHVybiBOdW1iZXJVdGlsLmludEJpdHNUb0Zsb2F0KCB2YWx1ZSAmIDB4ZmVmZmZmZmYgKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGZsb2F0IGVuY29kZWQgQUJHUiB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBSR0JBXG4gKiBieXRlcyAoMCAtIDI1NSkuIFVzZWZ1bCBmb3Igc2F2aW5nIGJhbmR3aWR0aCBpbiB2ZXJ0ZXggZGF0YS5cbiAqXG4gKiBAbWV0aG9kICBjb2xvclRvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSBSZWQgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBHcmVlbiBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIEJsdWUgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBBbHBoYSBieXRlICgwIC0gMjU1KVxuICogQHJldHVybiB7RmxvYXQzMn0gIGEgRmxvYXQzMiBvZiB0aGUgUkdCQSBjb2xvclxuICovXG5OdW1iZXJVdGlsLmNvbG9yVG9GbG9hdCA9IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0dmFyIGJpdHMgPSAoYSA8PCAyNCB8IGIgPDwgMTYgfCBnIDw8IDggfCByKTtcblx0cmV0dXJuIE51bWJlclV0aWwuaW50VG9GbG9hdENvbG9yKGJpdHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIG51bWJlciBpcyBhIHBvd2VyLW9mLXR3by5cbiAqXG4gKiBAbWV0aG9kICBpc1Bvd2VyT2ZUd29cbiAqIEBwYXJhbSAge051bWJlcn0gIG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSAgIHRydWUgaWYgcG93ZXItb2YtdHdvXG4gKi9cbk51bWJlclV0aWwuaXNQb3dlck9mVHdvID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gJiAobiAtIDEpKSA9PT0gMDtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgbmV4dCBoaWdoZXN0IHBvd2VyLW9mLXR3byBmcm9tIHRoZSBzcGVjaWZpZWQgbnVtYmVyLiBcbiAqIFxuICogQHBhcmFtICB7TnVtYmVyfSBuIHRoZSBudW1iZXIgdG8gdGVzdFxuICogQHJldHVybiB7TnVtYmVyfSAgIHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXIgb2YgdHdvXG4gKi9cbk51bWJlclV0aWwubmV4dFBvd2VyT2ZUd28gPSBmdW5jdGlvbihuKSB7XG5cdG4tLTtcblx0biB8PSBuID4+IDE7XG5cdG4gfD0gbiA+PiAyO1xuXHRuIHw9IG4gPj4gNDtcblx0biB8PSBuID4+IDg7XG5cdG4gfD0gbiA+PiAxNjtcblx0cmV0dXJuIG4rMTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTnVtYmVyVXRpbDsiLCIvKmpzbGludCBvbmV2YXI6dHJ1ZSwgdW5kZWY6dHJ1ZSwgbmV3Y2FwOnRydWUsIHJlZ2V4cDp0cnVlLCBiaXR3aXNlOnRydWUsIG1heGVycjo1MCwgaW5kZW50OjQsIHdoaXRlOmZhbHNlLCBub21lbjpmYWxzZSwgcGx1c3BsdXM6ZmFsc2UgKi9cbi8qZ2xvYmFsIGRlZmluZTpmYWxzZSwgcmVxdWlyZTpmYWxzZSwgZXhwb3J0czpmYWxzZSwgbW9kdWxlOmZhbHNlLCBzaWduYWxzOmZhbHNlICovXG5cbi8qKiBAbGljZW5zZVxuICogSlMgU2lnbmFscyA8aHR0cDovL21pbGxlcm1lZGVpcm9zLmdpdGh1Yi5jb20vanMtc2lnbmFscy8+XG4gKiBSZWxlYXNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2VcbiAqIEF1dGhvcjogTWlsbGVyIE1lZGVpcm9zXG4gKiBWZXJzaW9uOiAxLjAuMCAtIEJ1aWxkOiAyNjggKDIwMTIvMTEvMjkgMDU6NDggUE0pXG4gKi9cblxuKGZ1bmN0aW9uKGdsb2JhbCl7XG5cbiAgICAvLyBTaWduYWxCaW5kaW5nIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIC8qKlxuICAgICAqIE9iamVjdCB0aGF0IHJlcHJlc2VudHMgYSBiaW5kaW5nIGJldHdlZW4gYSBTaWduYWwgYW5kIGEgbGlzdGVuZXIgZnVuY3Rpb24uXG4gICAgICogPGJyIC8+LSA8c3Ryb25nPlRoaXMgaXMgYW4gaW50ZXJuYWwgY29uc3RydWN0b3IgYW5kIHNob3VsZG4ndCBiZSBjYWxsZWQgYnkgcmVndWxhciB1c2Vycy48L3N0cm9uZz5cbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IEpvYSBFYmVydCBBUzMgU2lnbmFsQmluZGluZyBhbmQgUm9iZXJ0IFBlbm5lcidzIFNsb3QgY2xhc3Nlcy5cbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqIEBpbnRlcm5hbFxuICAgICAqIEBuYW1lIFNpZ25hbEJpbmRpbmdcbiAgICAgKiBAcGFyYW0ge1NpZ25hbH0gc2lnbmFsIFJlZmVyZW5jZSB0byBTaWduYWwgb2JqZWN0IHRoYXQgbGlzdGVuZXIgaXMgY3VycmVudGx5IGJvdW5kIHRvLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzT25jZSBJZiBiaW5kaW5nIHNob3VsZCBiZSBleGVjdXRlZCBqdXN0IG9uY2UuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IFtwcmlvcml0eV0gVGhlIHByaW9yaXR5IGxldmVsIG9mIHRoZSBldmVudCBsaXN0ZW5lci4gKGRlZmF1bHQgPSAwKS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBTaWduYWxCaW5kaW5nKHNpZ25hbCwgbGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqIEB0eXBlIEZ1bmN0aW9uXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9saXN0ZW5lciA9IGxpc3RlbmVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBiaW5kaW5nIHNob3VsZCBiZSBleGVjdXRlZCBqdXN0IG9uY2UuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2lzT25jZSA9IGlzT25jZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgICAgICogQG1lbWJlck9mIFNpZ25hbEJpbmRpbmcucHJvdG90eXBlXG4gICAgICAgICAqIEBuYW1lIGNvbnRleHRcbiAgICAgICAgICogQHR5cGUgT2JqZWN0fHVuZGVmaW5lZHxudWxsXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBsaXN0ZW5lckNvbnRleHQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlZmVyZW5jZSB0byBTaWduYWwgb2JqZWN0IHRoYXQgbGlzdGVuZXIgaXMgY3VycmVudGx5IGJvdW5kIHRvLlxuICAgICAgICAgKiBAdHlwZSBTaWduYWxcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NpZ25hbCA9IHNpZ25hbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTGlzdGVuZXIgcHJpb3JpdHlcbiAgICAgICAgICogQHR5cGUgTnVtYmVyXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wcmlvcml0eSA9IHByaW9yaXR5IHx8IDA7XG4gICAgfVxuXG4gICAgU2lnbmFsQmluZGluZy5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgaXMgYWN0aXZlIGFuZCBzaG91bGQgYmUgZXhlY3V0ZWQuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERlZmF1bHQgcGFyYW1ldGVycyBwYXNzZWQgdG8gbGlzdGVuZXIgZHVyaW5nIGBTaWduYWwuZGlzcGF0Y2hgIGFuZCBgU2lnbmFsQmluZGluZy5leGVjdXRlYC4gKGN1cnJpZWQgcGFyYW1ldGVycylcbiAgICAgICAgICogQHR5cGUgQXJyYXl8bnVsbFxuICAgICAgICAgKi9cbiAgICAgICAgcGFyYW1zIDogbnVsbCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2FsbCBsaXN0ZW5lciBwYXNzaW5nIGFyYml0cmFyeSBwYXJhbWV0ZXJzLlxuICAgICAgICAgKiA8cD5JZiBiaW5kaW5nIHdhcyBhZGRlZCB1c2luZyBgU2lnbmFsLmFkZE9uY2UoKWAgaXQgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IHJlbW92ZWQgZnJvbSBzaWduYWwgZGlzcGF0Y2ggcXVldWUsIHRoaXMgbWV0aG9kIGlzIHVzZWQgaW50ZXJuYWxseSBmb3IgdGhlIHNpZ25hbCBkaXNwYXRjaC48L3A+XG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IFtwYXJhbXNBcnJdIEFycmF5IG9mIHBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIHRoZSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHsqfSBWYWx1ZSByZXR1cm5lZCBieSB0aGUgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBleGVjdXRlIDogZnVuY3Rpb24gKHBhcmFtc0Fycikge1xuICAgICAgICAgICAgdmFyIGhhbmRsZXJSZXR1cm4sIHBhcmFtcztcbiAgICAgICAgICAgIGlmICh0aGlzLmFjdGl2ZSAmJiAhIXRoaXMuX2xpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zID0gdGhpcy5wYXJhbXM/IHRoaXMucGFyYW1zLmNvbmNhdChwYXJhbXNBcnIpIDogcGFyYW1zQXJyO1xuICAgICAgICAgICAgICAgIGhhbmRsZXJSZXR1cm4gPSB0aGlzLl9saXN0ZW5lci5hcHBseSh0aGlzLmNvbnRleHQsIHBhcmFtcyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmRldGFjaCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBoYW5kbGVyUmV0dXJuO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZXRhY2ggYmluZGluZyBmcm9tIHNpZ25hbC5cbiAgICAgICAgICogLSBhbGlhcyB0bzogbXlTaWduYWwucmVtb3ZlKG15QmluZGluZy5nZXRMaXN0ZW5lcigpKTtcbiAgICAgICAgICogQHJldHVybiB7RnVuY3Rpb258bnVsbH0gSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsIG9yIGBudWxsYCBpZiBiaW5kaW5nIHdhcyBwcmV2aW91c2x5IGRldGFjaGVkLlxuICAgICAgICAgKi9cbiAgICAgICAgZGV0YWNoIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNCb3VuZCgpPyB0aGlzLl9zaWduYWwucmVtb3ZlKHRoaXMuX2xpc3RlbmVyLCB0aGlzLmNvbnRleHQpIDogbnVsbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Qm9vbGVhbn0gYHRydWVgIGlmIGJpbmRpbmcgaXMgc3RpbGwgYm91bmQgdG8gdGhlIHNpZ25hbCBhbmQgaGF2ZSBhIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgaXNCb3VuZCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAoISF0aGlzLl9zaWduYWwgJiYgISF0aGlzLl9saXN0ZW5lcik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IElmIFNpZ25hbEJpbmRpbmcgd2lsbCBvbmx5IGJlIGV4ZWN1dGVkIG9uY2UuXG4gICAgICAgICAqL1xuICAgICAgICBpc09uY2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5faXNPbmNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TGlzdGVuZXIgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fbGlzdGVuZXI7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge1NpZ25hbH0gU2lnbmFsIHRoYXQgbGlzdGVuZXIgaXMgY3VycmVudGx5IGJvdW5kIHRvLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0U2lnbmFsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NpZ25hbDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVsZXRlIGluc3RhbmNlIHByb3BlcnRpZXNcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9kZXN0cm95IDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3NpZ25hbDtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRleHQ7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbEJpbmRpbmcgaXNPbmNlOicgKyB0aGlzLl9pc09uY2UgKycsIGlzQm91bmQ6JysgdGhpcy5pc0JvdW5kKCkgKycsIGFjdGl2ZTonICsgdGhpcy5hY3RpdmUgKyAnXSc7XG4gICAgICAgIH1cblxuICAgIH07XG5cblxuLypnbG9iYWwgU2lnbmFsQmluZGluZzpmYWxzZSovXG5cbiAgICAvLyBTaWduYWwgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvLz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlTGlzdGVuZXIobGlzdGVuZXIsIGZuTmFtZSkge1xuICAgICAgICBpZiAodHlwZW9mIGxpc3RlbmVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoICdsaXN0ZW5lciBpcyBhIHJlcXVpcmVkIHBhcmFtIG9mIHtmbn0oKSBhbmQgc2hvdWxkIGJlIGEgRnVuY3Rpb24uJy5yZXBsYWNlKCd7Zm59JywgZm5OYW1lKSApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGV2ZW50IGJyb2FkY2FzdGVyXG4gICAgICogPGJyIC8+LSBpbnNwaXJlZCBieSBSb2JlcnQgUGVubmVyJ3MgQVMzIFNpZ25hbHMuXG4gICAgICogQG5hbWUgU2lnbmFsXG4gICAgICogQGF1dGhvciBNaWxsZXIgTWVkZWlyb3NcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBTaWduYWwoKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSBBcnJheS48U2lnbmFsQmluZGluZz5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2JpbmRpbmdzID0gW107XG4gICAgICAgIHRoaXMuX3ByZXZQYXJhbXMgPSBudWxsO1xuXG4gICAgICAgIC8vIGVuZm9yY2UgZGlzcGF0Y2ggdG8gYXdheXMgd29yayBvbiBzYW1lIGNvbnRleHQgKCM0NylcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLmRpc3BhdGNoID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIFNpZ25hbC5wcm90b3R5cGUuZGlzcGF0Y2guYXBwbHkoc2VsZiwgYXJndW1lbnRzKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBTaWduYWwucHJvdG90eXBlID0ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTaWduYWxzIFZlcnNpb24gTnVtYmVyXG4gICAgICAgICAqIEB0eXBlIFN0cmluZ1xuICAgICAgICAgKiBAY29uc3RcbiAgICAgICAgICovXG4gICAgICAgIFZFUlNJT04gOiAnMS4wLjAnLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgc2hvdWxkIGtlZXAgcmVjb3JkIG9mIHByZXZpb3VzbHkgZGlzcGF0Y2hlZCBwYXJhbWV0ZXJzIGFuZFxuICAgICAgICAgKiBhdXRvbWF0aWNhbGx5IGV4ZWN1dGUgbGlzdGVuZXIgZHVyaW5nIGBhZGQoKWAvYGFkZE9uY2UoKWAgaWYgU2lnbmFsIHdhc1xuICAgICAgICAgKiBhbHJlYWR5IGRpc3BhdGNoZWQgYmVmb3JlLlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqL1xuICAgICAgICBtZW1vcml6ZSA6IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfc2hvdWxkUHJvcGFnYXRlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgU2lnbmFsIGlzIGFjdGl2ZSBhbmQgc2hvdWxkIGJyb2FkY2FzdCBldmVudHMuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBTZXR0aW5nIHRoaXMgcHJvcGVydHkgZHVyaW5nIGEgZGlzcGF0Y2ggd2lsbCBvbmx5IGFmZmVjdCB0aGUgbmV4dCBkaXNwYXRjaCwgaWYgeW91IHdhbnQgdG8gc3RvcCB0aGUgcHJvcGFnYXRpb24gb2YgYSBzaWduYWwgdXNlIGBoYWx0KClgIGluc3RlYWQuPC9wPlxuICAgICAgICAgKiBAdHlwZSBib29sZWFuXG4gICAgICAgICAqL1xuICAgICAgICBhY3RpdmUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IGlzT25jZVxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF1cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IFtwcmlvcml0eV1cbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ31cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9yZWdpc3Rlckxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpIHtcblxuICAgICAgICAgICAgdmFyIHByZXZJbmRleCA9IHRoaXMuX2luZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lciwgbGlzdGVuZXJDb250ZXh0KSxcbiAgICAgICAgICAgICAgICBiaW5kaW5nO1xuXG4gICAgICAgICAgICBpZiAocHJldkluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIGJpbmRpbmcgPSB0aGlzLl9iaW5kaW5nc1twcmV2SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmIChiaW5kaW5nLmlzT25jZSgpICE9PSBpc09uY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgY2Fubm90IGFkZCcrIChpc09uY2U/ICcnIDogJ09uY2UnKSArJygpIHRoZW4gYWRkJysgKCFpc09uY2U/ICcnIDogJ09uY2UnKSArJygpIHRoZSBzYW1lIGxpc3RlbmVyIHdpdGhvdXQgcmVtb3ZpbmcgdGhlIHJlbGF0aW9uc2hpcCBmaXJzdC4nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGJpbmRpbmcgPSBuZXcgU2lnbmFsQmluZGluZyh0aGlzLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hZGRCaW5kaW5nKGJpbmRpbmcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZih0aGlzLm1lbW9yaXplICYmIHRoaXMuX3ByZXZQYXJhbXMpe1xuICAgICAgICAgICAgICAgIGJpbmRpbmcuZXhlY3V0ZSh0aGlzLl9wcmV2UGFyYW1zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7U2lnbmFsQmluZGluZ30gYmluZGluZ1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2FkZEJpbmRpbmcgOiBmdW5jdGlvbiAoYmluZGluZykge1xuICAgICAgICAgICAgLy9zaW1wbGlmaWVkIGluc2VydGlvbiBzb3J0XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgICAgIGRvIHsgLS1uOyB9IHdoaWxlICh0aGlzLl9iaW5kaW5nc1tuXSAmJiBiaW5kaW5nLl9wcmlvcml0eSA8PSB0aGlzLl9iaW5kaW5nc1tuXS5fcHJpb3JpdHkpO1xuICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Muc3BsaWNlKG4gKyAxLCAwLCBiaW5kaW5nKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHJldHVybiB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2luZGV4T2ZMaXN0ZW5lciA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgY29udGV4dCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgY3VyO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIGN1ciA9IHRoaXMuX2JpbmRpbmdzW25dO1xuICAgICAgICAgICAgICAgIGlmIChjdXIuX2xpc3RlbmVyID09PSBsaXN0ZW5lciAmJiBjdXIuY29udGV4dCA9PT0gY29udGV4dCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENoZWNrIGlmIGxpc3RlbmVyIHdhcyBhdHRhY2hlZCB0byBTaWduYWwuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF1cbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gaWYgU2lnbmFsIGhhcyB0aGUgc3BlY2lmaWVkIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgaGFzIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KSAhPT0gLTE7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFkZCBhIGxpc3RlbmVyIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIFNpZ25hbCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IFtwcmlvcml0eV0gVGhlIHByaW9yaXR5IGxldmVsIG9mIHRoZSBldmVudCBsaXN0ZW5lci4gTGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgZXhlY3V0ZWQgYmVmb3JlIGxpc3RlbmVycyB3aXRoIGxvd2VyIHByaW9yaXR5LiBMaXN0ZW5lcnMgd2l0aCBzYW1lIHByaW9yaXR5IGxldmVsIHdpbGwgYmUgZXhlY3V0ZWQgYXQgdGhlIHNhbWUgb3JkZXIgYXMgdGhleSB3ZXJlIGFkZGVkLiAoZGVmYXVsdCA9IDApXG4gICAgICAgICAqIEByZXR1cm4ge1NpZ25hbEJpbmRpbmd9IEFuIE9iamVjdCByZXByZXNlbnRpbmcgdGhlIGJpbmRpbmcgYmV0d2VlbiB0aGUgU2lnbmFsIGFuZCBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGFkZCA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuICAgICAgICAgICAgdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgJ2FkZCcpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIGZhbHNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGxpc3RlbmVyIHRvIHRoZSBzaWduYWwgdGhhdCBzaG91bGQgYmUgcmVtb3ZlZCBhZnRlciBmaXJzdCBleGVjdXRpb24gKHdpbGwgYmUgZXhlY3V0ZWQgb25seSBvbmNlKS5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkT25jZSA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuICAgICAgICAgICAgdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgJ2FkZE9uY2UnKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWdpc3Rlckxpc3RlbmVyKGxpc3RlbmVyLCB0cnVlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGEgc2luZ2xlIGxpc3RlbmVyIGZyb20gdGhlIGRpc3BhdGNoIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBIYW5kbGVyIGZ1bmN0aW9uIHRoYXQgc2hvdWxkIGJlIHJlbW92ZWQuXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF0gRXhlY3V0aW9uIGNvbnRleHQgKHNpbmNlIHlvdSBjYW4gYWRkIHRoZSBzYW1lIGhhbmRsZXIgbXVsdGlwbGUgdGltZXMgaWYgZXhlY3V0aW5nIGluIGEgZGlmZmVyZW50IGNvbnRleHQpLlxuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gTGlzdGVuZXIgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZSA6IGZ1bmN0aW9uIChsaXN0ZW5lciwgY29udGV4dCkge1xuICAgICAgICAgICAgdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgJ3JlbW92ZScpO1xuXG4gICAgICAgICAgICB2YXIgaSA9IHRoaXMuX2luZGV4T2ZMaXN0ZW5lcihsaXN0ZW5lciwgY29udGV4dCk7XG4gICAgICAgICAgICBpZiAoaSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kaW5nc1tpXS5fZGVzdHJveSgpOyAvL25vIHJlYXNvbiB0byBhIFNpZ25hbEJpbmRpbmcgZXhpc3QgaWYgaXQgaXNuJ3QgYXR0YWNoZWQgdG8gYSBzaWduYWxcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbGlzdGVuZXI7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgbGlzdGVuZXJzIGZyb20gdGhlIFNpZ25hbC5cbiAgICAgICAgICovXG4gICAgICAgIHJlbW92ZUFsbCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgd2hpbGUgKG4tLSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW25dLl9kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5sZW5ndGggPSAwO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9IE51bWJlciBvZiBsaXN0ZW5lcnMgYXR0YWNoZWQgdG8gdGhlIFNpZ25hbC5cbiAgICAgICAgICovXG4gICAgICAgIGdldE51bUxpc3RlbmVycyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3AgcHJvcGFnYXRpb24gb2YgdGhlIGV2ZW50LCBibG9ja2luZyB0aGUgZGlzcGF0Y2ggdG8gbmV4dCBsaXN0ZW5lcnMgb24gdGhlIHF1ZXVlLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gc2hvdWxkIGJlIGNhbGxlZCBvbmx5IGR1cmluZyBzaWduYWwgZGlzcGF0Y2gsIGNhbGxpbmcgaXQgYmVmb3JlL2FmdGVyIGRpc3BhdGNoIHdvbid0IGFmZmVjdCBzaWduYWwgYnJvYWRjYXN0LjwvcD5cbiAgICAgICAgICogQHNlZSBTaWduYWwucHJvdG90eXBlLmRpc2FibGVcbiAgICAgICAgICovXG4gICAgICAgIGhhbHQgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSBmYWxzZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGlzcGF0Y2gvQnJvYWRjYXN0IFNpZ25hbCB0byBhbGwgbGlzdGVuZXJzIGFkZGVkIHRvIHRoZSBxdWV1ZS5cbiAgICAgICAgICogQHBhcmFtIHsuLi4qfSBbcGFyYW1zXSBQYXJhbWV0ZXJzIHRoYXQgc2hvdWxkIGJlIHBhc3NlZCB0byBlYWNoIGhhbmRsZXIuXG4gICAgICAgICAqL1xuICAgICAgICBkaXNwYXRjaCA6IGZ1bmN0aW9uIChwYXJhbXMpIHtcbiAgICAgICAgICAgIGlmICghIHRoaXMuYWN0aXZlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcGFyYW1zQXJyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSxcbiAgICAgICAgICAgICAgICBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGJpbmRpbmdzO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5tZW1vcml6ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3ByZXZQYXJhbXMgPSBwYXJhbXNBcnI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghIG4pIHtcbiAgICAgICAgICAgICAgICAvL3Nob3VsZCBjb21lIGFmdGVyIG1lbW9yaXplXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBiaW5kaW5ncyA9IHRoaXMuX2JpbmRpbmdzLnNsaWNlKCk7IC8vY2xvbmUgYXJyYXkgaW4gY2FzZSBhZGQvcmVtb3ZlIGl0ZW1zIGR1cmluZyBkaXNwYXRjaFxuICAgICAgICAgICAgdGhpcy5fc2hvdWxkUHJvcGFnYXRlID0gdHJ1ZTsgLy9pbiBjYXNlIGBoYWx0YCB3YXMgY2FsbGVkIGJlZm9yZSBkaXNwYXRjaCBvciBkdXJpbmcgdGhlIHByZXZpb3VzIGRpc3BhdGNoLlxuXG4gICAgICAgICAgICAvL2V4ZWN1dGUgYWxsIGNhbGxiYWNrcyB1bnRpbCBlbmQgb2YgdGhlIGxpc3Qgb3IgdW50aWwgYSBjYWxsYmFjayByZXR1cm5zIGBmYWxzZWAgb3Igc3RvcHMgcHJvcGFnYXRpb25cbiAgICAgICAgICAgIC8vcmV2ZXJzZSBsb29wIHNpbmNlIGxpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGFkZGVkIGF0IHRoZSBlbmQgb2YgdGhlIGxpc3RcbiAgICAgICAgICAgIGRvIHsgbi0tOyB9IHdoaWxlIChiaW5kaW5nc1tuXSAmJiB0aGlzLl9zaG91bGRQcm9wYWdhdGUgJiYgYmluZGluZ3Nbbl0uZXhlY3V0ZShwYXJhbXNBcnIpICE9PSBmYWxzZSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZvcmdldCBtZW1vcml6ZWQgYXJndW1lbnRzLlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5tZW1vcml6ZVxuICAgICAgICAgKi9cbiAgICAgICAgZm9yZ2V0IDogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHRoaXMuX3ByZXZQYXJhbXMgPSBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYWxsIGJpbmRpbmdzIGZyb20gc2lnbmFsIGFuZCBkZXN0cm95IGFueSByZWZlcmVuY2UgdG8gZXh0ZXJuYWwgb2JqZWN0cyAoZGVzdHJveSBTaWduYWwgb2JqZWN0KS5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IGNhbGxpbmcgYW55IG1ldGhvZCBvbiB0aGUgc2lnbmFsIGluc3RhbmNlIGFmdGVyIGNhbGxpbmcgZGlzcG9zZSB3aWxsIHRocm93IGVycm9ycy48L3A+XG4gICAgICAgICAqL1xuICAgICAgICBkaXNwb3NlIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmVBbGwoKTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9iaW5kaW5ncztcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl9wcmV2UGFyYW1zO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IFN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgb2JqZWN0LlxuICAgICAgICAgKi9cbiAgICAgICAgdG9TdHJpbmcgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJ1tTaWduYWwgYWN0aXZlOicrIHRoaXMuYWN0aXZlICsnIG51bUxpc3RlbmVyczonKyB0aGlzLmdldE51bUxpc3RlbmVycygpICsnXSc7XG4gICAgICAgIH1cblxuICAgIH07XG5cblxuICAgIC8vIE5hbWVzcGFjZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogU2lnbmFscyBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZXNwYWNlXG4gICAgICogQG5hbWUgc2lnbmFsc1xuICAgICAqL1xuICAgIHZhciBzaWduYWxzID0gU2lnbmFsO1xuXG4gICAgLyoqXG4gICAgICogQ3VzdG9tIGV2ZW50IGJyb2FkY2FzdGVyXG4gICAgICogQHNlZSBTaWduYWxcbiAgICAgKi9cbiAgICAvLyBhbGlhcyBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgKHNlZSAjZ2gtNDQpXG4gICAgc2lnbmFscy5TaWduYWwgPSBTaWduYWw7XG5cblxuXG4gICAgLy9leHBvcnRzIHRvIG11bHRpcGxlIGVudmlyb25tZW50c1xuICAgIGlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCl7IC8vQU1EXG4gICAgICAgIGRlZmluZShmdW5jdGlvbiAoKSB7IHJldHVybiBzaWduYWxzOyB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKXsgLy9ub2RlXG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gc2lnbmFscztcbiAgICB9IGVsc2UgeyAvL2Jyb3dzZXJcbiAgICAgICAgLy91c2Ugc3RyaW5nIGJlY2F1c2Ugb2YgR29vZ2xlIGNsb3N1cmUgY29tcGlsZXIgQURWQU5DRURfTU9ERVxuICAgICAgICAvKmpzbGludCBzdWI6dHJ1ZSAqL1xuICAgICAgICBnbG9iYWxbJ3NpZ25hbHMnXSA9IHNpZ25hbHM7XG4gICAgfVxuXG59KHRoaXMpKTtcbiIsImZ1bmN0aW9uIGhhc0dldHRlck9yU2V0dGVyKGRlZikge1xuXHRyZXR1cm4gKCEhZGVmLmdldCAmJiB0eXBlb2YgZGVmLmdldCA9PT0gXCJmdW5jdGlvblwiKSB8fCAoISFkZWYuc2V0ICYmIHR5cGVvZiBkZWYuc2V0ID09PSBcImZ1bmN0aW9uXCIpO1xufVxuXG5mdW5jdGlvbiBnZXRQcm9wZXJ0eShkZWZpbml0aW9uLCBrLCBpc0NsYXNzRGVzY3JpcHRvcikge1xuXHQvL1RoaXMgbWF5IGJlIGEgbGlnaHR3ZWlnaHQgb2JqZWN0LCBPUiBpdCBtaWdodCBiZSBhIHByb3BlcnR5XG5cdC8vdGhhdCB3YXMgZGVmaW5lZCBwcmV2aW91c2x5LlxuXHRcblx0Ly9Gb3Igc2ltcGxlIGNsYXNzIGRlc2NyaXB0b3JzIHdlIGNhbiBqdXN0IGFzc3VtZSBpdHMgTk9UIHByZXZpb3VzbHkgZGVmaW5lZC5cblx0dmFyIGRlZiA9IGlzQ2xhc3NEZXNjcmlwdG9yIFxuXHRcdFx0XHQ/IGRlZmluaXRpb25ba10gXG5cdFx0XHRcdDogT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihkZWZpbml0aW9uLCBrKTtcblxuXHRpZiAoIWlzQ2xhc3NEZXNjcmlwdG9yICYmIGRlZi52YWx1ZSAmJiB0eXBlb2YgZGVmLnZhbHVlID09PSBcIm9iamVjdFwiKSB7XG5cdFx0ZGVmID0gZGVmLnZhbHVlO1xuXHR9XG5cblxuXHQvL1RoaXMgbWlnaHQgYmUgYSByZWd1bGFyIHByb3BlcnR5LCBvciBpdCBtYXkgYmUgYSBnZXR0ZXIvc2V0dGVyIHRoZSB1c2VyIGRlZmluZWQgaW4gYSBjbGFzcy5cblx0aWYgKCBkZWYgJiYgaGFzR2V0dGVyT3JTZXR0ZXIoZGVmKSApIHtcblx0XHRpZiAodHlwZW9mIGRlZi5lbnVtZXJhYmxlID09PSBcInVuZGVmaW5lZFwiKVxuXHRcdFx0ZGVmLmVudW1lcmFibGUgPSB0cnVlO1xuXHRcdGlmICh0eXBlb2YgZGVmLmNvbmZpZ3VyYWJsZSA9PT0gXCJ1bmRlZmluZWRcIilcblx0XHRcdGRlZi5jb25maWd1cmFibGUgPSB0cnVlO1xuXHRcdHJldHVybiBkZWY7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGhhc05vbkNvbmZpZ3VyYWJsZShvYmosIGspIHtcblx0dmFyIHByb3AgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwgayk7XG5cdGlmICghcHJvcClcblx0XHRyZXR1cm4gZmFsc2U7XG5cblx0aWYgKHByb3AudmFsdWUgJiYgdHlwZW9mIHByb3AudmFsdWUgPT09IFwib2JqZWN0XCIpXG5cdFx0cHJvcCA9IHByb3AudmFsdWU7XG5cblx0aWYgKHByb3AuY29uZmlndXJhYmxlID09PSBmYWxzZSkgXG5cdFx0cmV0dXJuIHRydWU7XG5cblx0cmV0dXJuIGZhbHNlO1xufVxuXG4vL1RPRE86IE9uIGNyZWF0ZSwgXG4vL1x0XHRPbiBtaXhpbiwgXG5cbmZ1bmN0aW9uIGV4dGVuZChjdG9yLCBkZWZpbml0aW9uLCBpc0NsYXNzRGVzY3JpcHRvciwgZXh0ZW5kKSB7XG5cdGZvciAodmFyIGsgaW4gZGVmaW5pdGlvbikge1xuXHRcdGlmICghZGVmaW5pdGlvbi5oYXNPd25Qcm9wZXJ0eShrKSlcblx0XHRcdGNvbnRpbnVlO1xuXG5cdFx0dmFyIGRlZiA9IGdldFByb3BlcnR5KGRlZmluaXRpb24sIGssIGlzQ2xhc3NEZXNjcmlwdG9yKTtcblxuXHRcdGlmIChkZWYgIT09IGZhbHNlKSB7XG5cdFx0XHQvL0lmIEV4dGVuZHMgaXMgdXNlZCwgd2Ugd2lsbCBjaGVjayBpdHMgcHJvdG90eXBlIHRvIHNlZSBpZiBcblx0XHRcdC8vdGhlIGZpbmFsIHZhcmlhYmxlIGV4aXN0cy5cblx0XHRcdFxuXHRcdFx0dmFyIHBhcmVudCA9IGV4dGVuZCB8fCBjdG9yO1xuXHRcdFx0aWYgKGhhc05vbkNvbmZpZ3VyYWJsZShwYXJlbnQucHJvdG90eXBlLCBrKSkge1xuXG5cdFx0XHRcdC8vanVzdCBza2lwIHRoZSBmaW5hbCBwcm9wZXJ0eVxuXHRcdFx0XHRpZiAoQ2xhc3MuaWdub3JlRmluYWxzKVxuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXG5cdFx0XHRcdC8vV2UgY2Fubm90IHJlLWRlZmluZSBhIHByb3BlcnR5IHRoYXQgaXMgY29uZmlndXJhYmxlPWZhbHNlLlxuXHRcdFx0XHQvL1NvIHdlIHdpbGwgY29uc2lkZXIgdGhlbSBmaW5hbCBhbmQgdGhyb3cgYW4gZXJyb3IuIFRoaXMgaXMgYnlcblx0XHRcdFx0Ly9kZWZhdWx0IHNvIGl0IGlzIGNsZWFyIHRvIHRoZSBkZXZlbG9wZXIgd2hhdCBpcyBoYXBwZW5pbmcuXG5cdFx0XHRcdC8vWW91IGNhbiBzZXQgaWdub3JlRmluYWxzIHRvIHRydWUgaWYgeW91IG5lZWQgdG8gZXh0ZW5kIGEgY2xhc3Ncblx0XHRcdFx0Ly93aGljaCBoYXMgY29uZmlndXJhYmxlPWZhbHNlOyBpdCB3aWxsIHNpbXBseSBub3QgcmUtZGVmaW5lIGZpbmFsIHByb3BlcnRpZXMuXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBvdmVycmlkZSBmaW5hbCBwcm9wZXJ0eSAnXCIra1xuXHRcdFx0XHRcdFx0XHQrXCInLCBzZXQgQ2xhc3MuaWdub3JlRmluYWxzID0gdHJ1ZSB0byBza2lwXCIpO1xuXHRcdFx0fVxuXG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoY3Rvci5wcm90b3R5cGUsIGssIGRlZik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0b3IucHJvdG90eXBlW2tdID0gZGVmaW5pdGlvbltrXTtcblx0XHR9XG5cblx0fVxufVxuXG4vKipcbiAqL1xuZnVuY3Rpb24gbWl4aW4obXlDbGFzcywgbWl4aW5zKSB7XG5cdGlmICghbWl4aW5zKVxuXHRcdHJldHVybjtcblxuXHRpZiAoIUFycmF5LmlzQXJyYXkobWl4aW5zKSlcblx0XHRtaXhpbnMgPSBbbWl4aW5zXTtcblxuXHRmb3IgKHZhciBpPTA7IGk8bWl4aW5zLmxlbmd0aDsgaSsrKSB7XG5cdFx0ZXh0ZW5kKG15Q2xhc3MsIG1peGluc1tpXS5wcm90b3R5cGUgfHwgbWl4aW5zW2ldKTtcblx0fVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgY2xhc3Mgd2l0aCB0aGUgZ2l2ZW4gZGVzY3JpcHRvci5cbiAqIFRoZSBjb25zdHJ1Y3RvciwgZGVmaW5lZCBieSB0aGUgbmFtZSBgaW5pdGlhbGl6ZWAsXG4gKiBpcyBhbiBvcHRpb25hbCBmdW5jdGlvbi4gSWYgdW5zcGVjaWZpZWQsIGFuIGFub255bW91c1xuICogZnVuY3Rpb24gd2lsbCBiZSB1c2VkIHdoaWNoIGNhbGxzIHRoZSBwYXJlbnQgY2xhc3MgKGlmXG4gKiBvbmUgZXhpc3RzKS4gXG4gKlxuICogWW91IGNhbiBhbHNvIHVzZSBgRXh0ZW5kc2AgYW5kIGBNaXhpbnNgIHRvIHByb3ZpZGUgc3ViY2xhc3NpbmdcbiAqIGFuZCBpbmhlcml0YW5jZS5cbiAqXG4gKiBAY2xhc3MgIENsYXNzXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZpbml0aW9uIGEgZGljdGlvbmFyeSBvZiBmdW5jdGlvbnMgZm9yIHRoZSBjbGFzc1xuICogQGV4YW1wbGVcbiAqXG4gKiBcdFx0dmFyIE15Q2xhc3MgPSBuZXcgQ2xhc3Moe1xuICogXHRcdFxuICogXHRcdFx0aW5pdGlhbGl6ZTogZnVuY3Rpb24oKSB7XG4gKiBcdFx0XHRcdHRoaXMuZm9vID0gMi4wO1xuICogXHRcdFx0fSxcbiAqXG4gKiBcdFx0XHRiYXI6IGZ1bmN0aW9uKCkge1xuICogXHRcdFx0XHRyZXR1cm4gdGhpcy5mb28gKyA1O1xuICogXHRcdFx0fVxuICogXHRcdH0pO1xuICovXG5mdW5jdGlvbiBDbGFzcyhkZWZpbml0aW9uKSB7XG5cdGlmICghZGVmaW5pdGlvbilcblx0XHRkZWZpbml0aW9uID0ge307XG5cblx0Ly9UaGUgdmFyaWFibGUgbmFtZSBoZXJlIGRpY3RhdGVzIHdoYXQgd2Ugc2VlIGluIENocm9tZSBkZWJ1Z2dlclxuXHR2YXIgaW5pdGlhbGl6ZTtcblx0dmFyIEV4dGVuZHM7XG5cblx0aWYgKGRlZmluaXRpb24uaW5pdGlhbGl6ZSkge1xuXHRcdGlmICh0eXBlb2YgZGVmaW5pdGlvbi5pbml0aWFsaXplICE9PSBcImZ1bmN0aW9uXCIpXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJpbml0aWFsaXplIG11c3QgYmUgYSBmdW5jdGlvblwiKTtcblx0XHRpbml0aWFsaXplID0gZGVmaW5pdGlvbi5pbml0aWFsaXplO1xuXG5cdFx0Ly9Vc3VhbGx5IHdlIHNob3VsZCBhdm9pZCBcImRlbGV0ZVwiIGluIFY4IGF0IGFsbCBjb3N0cy5cblx0XHQvL0hvd2V2ZXIsIGl0cyB1bmxpa2VseSB0byBtYWtlIGFueSBwZXJmb3JtYW5jZSBkaWZmZXJlbmNlXG5cdFx0Ly9oZXJlIHNpbmNlIHdlIG9ubHkgY2FsbCB0aGlzIG9uIGNsYXNzIGNyZWF0aW9uIChpLmUuIG5vdCBvYmplY3QgY3JlYXRpb24pLlxuXHRcdGRlbGV0ZSBkZWZpbml0aW9uLmluaXRpYWxpemU7XG5cdH0gZWxzZSB7XG5cdFx0aWYgKGRlZmluaXRpb24uRXh0ZW5kcykge1xuXHRcdFx0dmFyIGJhc2UgPSBkZWZpbml0aW9uLkV4dGVuZHM7XG5cdFx0XHRpbml0aWFsaXplID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRiYXNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cdFx0XHR9OyBcblx0XHR9IGVsc2Uge1xuXHRcdFx0aW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHt9OyBcblx0XHR9XG5cdH1cblxuXHRpZiAoZGVmaW5pdGlvbi5FeHRlbmRzKSB7XG5cdFx0aW5pdGlhbGl6ZS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKGRlZmluaXRpb24uRXh0ZW5kcy5wcm90b3R5cGUpO1xuXHRcdGluaXRpYWxpemUucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gaW5pdGlhbGl6ZTtcblx0XHQvL2ZvciBnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgdG8gd29yaywgd2UgbmVlZCB0byBhY3Rcblx0XHQvL2RpcmVjdGx5IG9uIHRoZSBFeHRlbmRzIChvciBNaXhpbilcblx0XHRFeHRlbmRzID0gZGVmaW5pdGlvbi5FeHRlbmRzO1xuXHRcdGRlbGV0ZSBkZWZpbml0aW9uLkV4dGVuZHM7XG5cdH0gZWxzZSB7XG5cdFx0aW5pdGlhbGl6ZS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBpbml0aWFsaXplO1xuXHR9XG5cblx0Ly9HcmFiIHRoZSBtaXhpbnMsIGlmIHRoZXkgYXJlIHNwZWNpZmllZC4uLlxuXHR2YXIgbWl4aW5zID0gbnVsbDtcblx0aWYgKGRlZmluaXRpb24uTWl4aW5zKSB7XG5cdFx0bWl4aW5zID0gZGVmaW5pdGlvbi5NaXhpbnM7XG5cdFx0ZGVsZXRlIGRlZmluaXRpb24uTWl4aW5zO1xuXHR9XG5cblx0Ly9GaXJzdCwgbWl4aW4gaWYgd2UgY2FuLlxuXHRtaXhpbihpbml0aWFsaXplLCBtaXhpbnMpO1xuXG5cdC8vTm93IHdlIGdyYWIgdGhlIGFjdHVhbCBkZWZpbml0aW9uIHdoaWNoIGRlZmluZXMgdGhlIG92ZXJyaWRlcy5cblx0ZXh0ZW5kKGluaXRpYWxpemUsIGRlZmluaXRpb24sIHRydWUsIEV4dGVuZHMpO1xuXG5cdHJldHVybiBpbml0aWFsaXplO1xufTtcblxuQ2xhc3MuZXh0ZW5kID0gZXh0ZW5kO1xuQ2xhc3MubWl4aW4gPSBtaXhpbjtcbkNsYXNzLmlnbm9yZUZpbmFscyA9IGZhbHNlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsYXNzOyIsIi8qXG4gKiByYWYuanNcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9uZ3J5bWFuL3JhZi5qc1xuICpcbiAqIG9yaWdpbmFsIHJlcXVlc3RBbmltYXRpb25GcmFtZSBwb2x5ZmlsbCBieSBFcmlrIE3DtmxsZXJcbiAqIGluc3BpcmVkIGZyb20gcGF1bF9pcmlzaCBnaXN0IGFuZCBwb3N0XG4gKlxuICogQ29weXJpZ2h0IChjKSAyMDEzIG5ncnltYW5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAqL1xuXG4oZnVuY3Rpb24od2luZG93KSB7XG5cdHZhciBsYXN0VGltZSA9IDAsXG5cdFx0dmVuZG9ycyA9IFsnd2Via2l0JywgJ21veiddLFxuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUsXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUsXG5cdFx0aSA9IHZlbmRvcnMubGVuZ3RoO1xuXG5cdC8vIHRyeSB0byB1bi1wcmVmaXggZXhpc3RpbmcgcmFmXG5cdHdoaWxlICgtLWkgPj0gMCAmJiAhcmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93W3ZlbmRvcnNbaV0gKyAnUmVxdWVzdEFuaW1hdGlvbkZyYW1lJ107XG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdDYW5jZWxBbmltYXRpb25GcmFtZSddO1xuXHR9XG5cblx0Ly8gcG9seWZpbGwgd2l0aCBzZXRUaW1lb3V0IGZhbGxiYWNrXG5cdC8vIGhlYXZpbHkgaW5zcGlyZWQgZnJvbSBAZGFyaXVzIGdpc3QgbW9kOiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvMTU3OTY3MSNjb21tZW50LTgzNzk0NVxuXHRpZiAoIXJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCAhY2FuY2VsQW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0dmFyIG5vdyA9IERhdGUubm93KCksIG5leHRUaW1lID0gTWF0aC5tYXgobGFzdFRpbWUgKyAxNiwgbm93KTtcblx0XHRcdHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRjYWxsYmFjayhsYXN0VGltZSA9IG5leHRUaW1lKTtcblx0XHRcdH0sIG5leHRUaW1lIC0gbm93KTtcblx0XHR9O1xuXG5cdFx0Y2FuY2VsQW5pbWF0aW9uRnJhbWUgPSBjbGVhclRpbWVvdXQ7XG5cdH1cblxuXHQvLyBleHBvcnQgdG8gd2luZG93XG5cdHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG5cdHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSA9IGNhbmNlbEFuaW1hdGlvbkZyYW1lO1xufSh3aW5kb3cpKTsiLCJ2YXIgZG9tcmVhZHkgPSByZXF1aXJlKCdkb21yZWFkeScpO1xuXG52YXIgV2ViR0xDb250ZXh0ID0gcmVxdWlyZSgna2FtaScpLldlYkdMQ29udGV4dDtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgna2FtaScpLlRleHR1cmU7XG5cbnZhciBTcHJpdGVCYXRjaCA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDtcbnZhciBGcmFtZUJ1ZmZlciA9IHJlcXVpcmUoJ2thbWknKS5GcmFtZUJ1ZmZlcjtcbnZhciBUZXh0dXJlUmVnaW9uID0gcmVxdWlyZSgna2FtaScpLlRleHR1cmVSZWdpb247XG52YXIgU2hhZGVyUHJvZ3JhbSA9IHJlcXVpcmUoJ2thbWknKS5TaGFkZXJQcm9ncmFtO1xuXG4vL2luY2x1ZGUgcG9seWZpbGwgZm9yIHJlcXVlc3RBbmltYXRpb25GcmFtZVxucmVxdWlyZSgncmFmLmpzJyk7XG5cbnZhciBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG5cbi8vTG9hZCB0aGUgc2hvY2t3YXZlIHNoYWRlci4uLiBJdCdzIGEgdmVyeSBzaW1wbGUgb25lIGZyb20gaGVyZTpcbi8vaHR0cDovL3d3dy5nZWVrczNkLmNvbS8yMDA5MTExNi9zaGFkZXItbGlicmFyeS0yZC1zaG9ja3dhdmUtcG9zdC1wcm9jZXNzaW5nLWZpbHRlci1nbHNsL1xuXG4vL1NlZSBoZXJlIGZvciBvdGhlciByaXBwbGUgc2hhZGVyczpcbi8vaHR0cDovL2FkcmlhbmJvZWluZy5ibG9nc3BvdC5jb20vMjAxMS8wMi9yaXBwbGUtZWZmZWN0LWluLXdlYmdsLmh0bWxcbi8vaHR0cDovL3d3dy5wYXRyaWNpb2dvbnphbGV6dml2by5jb20vYmxvZy8/cD02NTdcbnZhciB2ZXJ0ID0gXCIvL2luY29taW5nIFBvc2l0aW9uIGF0dHJpYnV0ZSBmcm9tIG91ciBTcHJpdGVCYXRjaFxcbmF0dHJpYnV0ZSB2ZWMyIFBvc2l0aW9uO1xcbmF0dHJpYnV0ZSB2ZWM0IENvbG9yO1xcbmF0dHJpYnV0ZSB2ZWMyIFRleENvb3JkMDtcXG51bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1xcbnZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1xcbnZhcnlpbmcgdmVjNCB2Q29sb3I7XFxuXFxudm9pZCBtYWluKHZvaWQpIHtcXG4gICBnbF9Qb3NpdGlvbiA9IHZlYzQoIFBvc2l0aW9uLnggLyB1X3Byb2plY3Rpb24ueCAtIDEuMCwgUG9zaXRpb24ueSAvIC11X3Byb2plY3Rpb24ueSArIDEuMCAsIDAuMCwgMS4wKTtcXG4gICB2VGV4Q29vcmQwID0gVGV4Q29vcmQwO1xcbiAgIHZDb2xvciA9IENvbG9yO1xcbn1cIjtcbnZhciBmcmFnID0gXCIjaWZkZWYgR0xfRVNcXG5wcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG4jZW5kaWZcXG5cXG51bmlmb3JtIHNhbXBsZXIyRCB1X3RleHR1cmUwOyAgIC8vIDBcXG51bmlmb3JtIHZlYzIgY2VudGVyOyAgICAgIC8vIE1vdXNlIHBvc2l0aW9uLCBub3JtYWxpemVkIDAuMCB0byAxLjBcXG51bmlmb3JtIGZsb2F0IHRpbWU7ICAgICAgIC8vIGVmZmVjdCBlbGFwc2VkIHRpbWVcXG51bmlmb3JtIHZlYzMgc2hvY2tQYXJhbXM7XFxuXFxudmFyeWluZyB2ZWMyIHZUZXhDb29yZDA7XFxudmFyeWluZyB2ZWM0IHZDb2xvcjtcXG5cXG52b2lkIG1haW4oKSB7IFxcbiAgICB2ZWMyIHV2ID0gdlRleENvb3JkMC54eTtcXG4gICAgdmVjMiB0ZXhDb29yZCA9IHV2O1xcbiAgICBmbG9hdCBkaXN0ID0gZGlzdGFuY2UodXYsIGNlbnRlcik7XFxuICAgIGlmICggKGRpc3QgPD0gKHRpbWUgKyBzaG9ja1BhcmFtcy56KSkgJiYgKGRpc3QgPj0gKHRpbWUgLSBzaG9ja1BhcmFtcy56KSkgKSBcXG4gICAge1xcbiAgICAgICAgZmxvYXQgZGlmZiA9IChkaXN0IC0gdGltZSk7IFxcbiAgICAgICAgZmxvYXQgcG93RGlmZiA9IDEuMCAtIHBvdyhhYnMoZGlmZipzaG9ja1BhcmFtcy54KSwgc2hvY2tQYXJhbXMueSk7IFxcbiAgICAgICAgZmxvYXQgZGlmZlRpbWUgPSBkaWZmICAqIHBvd0RpZmY7IFxcbiAgICAgICAgdmVjMiBkaWZmVVYgPSBub3JtYWxpemUodXYgLSBjZW50ZXIpOyBcXG4gICAgICAgIHRleENvb3JkID0gdXYgKyAoZGlmZlVWICogZGlmZlRpbWUpO1xcbiAgICB9XFxuICAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRCh1X3RleHR1cmUwLCB0ZXhDb29yZCkgKiB2Q29sb3I7XFxufVxcblwiO1xuXG5kb21yZWFkeShmdW5jdGlvbigpIHtcbiAgICB2YXIgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgICB2YXIgd2lkdGggPSA1MDA7XG4gICAgdmFyIGhlaWdodCA9IDUwMDtcblxuICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xuICAgIGNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XG4gICAgXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjYW52YXMpO1xuXG4gICAgdmFyIHRleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICB0ZXh0LnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xuICAgIHRleHQuc3R5bGUudG9wID0gKGhlaWdodCsxMCkrXCJweFwiO1xuICAgIHRleHQuc3R5bGUubGVmdCA9IFwiNXB4XCI7XG4gICAgdGV4dC5pbm5lckhUTUwgPSBcIkNsaWNrIG9uIHRoZSBjYW52YXMgdG8gc2VlIHRoZSBleHBsb3Npb24gZWZmZWN0XCJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRleHQpO1xuXG4gICAgLy9jcmVhdGUgb3VyIFdlYkdMIGNvbnRleHRcbiAgICB2YXIgY29udGV4dCA9IG5ldyBXZWJHTENvbnRleHQod2lkdGgsIGhlaWdodCwgY2FudmFzKTtcblxuICAgIHZhciBiYXRjaCA9IG5ldyBTcHJpdGVCYXRjaChjb250ZXh0KTtcbiAgICBcbiAgICB2YXIgZ3Jhc3NUZXggPSBuZXcgVGV4dHVyZShjb250ZXh0LCBcImltZy9ncmFzcy5wbmdcIik7XG4gICAgZ3Jhc3NUZXguc2V0RmlsdGVyKFRleHR1cmUuRmlsdGVyLkxJTkVBUik7XG4gICAgZ3Jhc3NUZXguc2V0V3JhcChUZXh0dXJlLldyYXAuUkVQRUFUKTtcblxuICAgIHZhciBucGNUZXggPSBuZXcgVGV4dHVyZShjb250ZXh0LCBcImltZy9ndXkucG5nXCIpO1xuXG4gICAgdmFyIGZibyA9IG5ldyBGcmFtZUJ1ZmZlcihjb250ZXh0LCB3aWR0aCwgaGVpZ2h0KTtcbiAgICB2YXIgZmJvVGV4UmVnaW9uID0gbmV3IFRleHR1cmVSZWdpb24oZmJvLnRleHR1cmUpO1xuICAgIGZib1RleFJlZ2lvbi5mbGlwKGZhbHNlLCB0cnVlKTtcblxuICAgIHZhciBzaG9ja3dhdmVTaGFkZXIgPSBuZXcgU2hhZGVyUHJvZ3JhbShjb250ZXh0LCB2ZXJ0LCBmcmFnKTtcbiAgICBpZiAoc2hvY2t3YXZlU2hhZGVyLmxvZylcbiAgICAgICAgY29uc29sZS53YXJuKHNob2Nrd2F2ZVNoYWRlci5sb2cpO1xuXG4gICAgdmFyIG1vdXNlWCA9IDAsIFxuICAgICAgICBtb3VzZVkgPSAwLFxuICAgICAgICB0aW1lID0gMTAwMCxcbiAgICAgICAgcGxheWVyVGltZSA9IDA7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbihldikge1xuICAgICAgICB0aW1lID0gMDtcbiAgICAgICAgbW91c2VYID0gZXYucGFnZVggLyBjYW52YXMud2lkdGg7XG4gICAgICAgIG1vdXNlWSA9IDEuMCAtIGV2LnBhZ2VZIC8gY2FudmFzLmhlaWdodDtcbiAgICB9LCB0cnVlKTtcblxuXG4gICAgZnVuY3Rpb24gcmVuZGVyKCkge1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcbiAgICAgICAgdmFyIGdsID0gY29udGV4dC5nbDtcblxuICAgICAgICAvL3N0YXJ0IHJlbmRlcmluZyB0byBvZmYtc2NyZWVuIHRleHR1cmVcbiAgICAgICAgZmJvLmJlZ2luKCk7XG5cbiAgICAgICAgLy9jbGVhciB0aGUgRkJPIHRleFxuICAgICAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcblxuICAgICAgICBiYXRjaC5zaGFkZXIgPSBiYXRjaC5kZWZhdWx0U2hhZGVyO1xuICAgICAgICBiYXRjaC5yZXNpemUoZmJvLndpZHRoLCBmYm8uaGVpZ2h0KTtcbiAgICAgICAgYmF0Y2guYmVnaW4oKTtcblxuICAgICAgICAvL3RpbGUgaXQgdG8gdGhlIGNhbnZhc1xuICAgICAgICAvL3RoaXMgb25seSB3b3JrcyB3aXRoIFBPVCByZXBlYXQtd3JhcHBlZCB0ZXh0dXJlcy4gaS5lLiBubyBzcHJpdGUgc2hlZXRzXG4gICAgICAgIHZhciBucmVwZWF0cyA9IDI7XG4gICAgICAgIGJhdGNoLmRyYXcoZ3Jhc3NUZXgsIDAsIDAsIHdpZHRoLCBoZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIDAsIDAsIG5yZXBlYXRzLCBucmVwZWF0cyk7XG4gICAgICAgIFxuICAgICAgICAvL2FuaW1hdGUgb25lIG9mIHRoZSBwbGF5ZXIncyBtb3ZlbWVudHMuLi5cbiAgICAgICAgdmFyIGFuaW0gPSBNYXRoLnNpbihwbGF5ZXJUaW1lKz0wLjAyKSAqIDEwMDtcblxuICAgICAgICAvL2RyYXcgc29tZSBwbGF5ZXIgc3ByaXRlcyAuLi5cbiAgICAgICAgYmF0Y2guZHJhdyhucGNUZXgsIDEwNSwgNTAsIG5wY1RleC53aWR0aCoyLCBucGNUZXguaGVpZ2h0KjIpO1xuICAgICAgICBiYXRjaC5kcmF3KG5wY1RleCwgMjU1LCAzNTAsIG5wY1RleC53aWR0aCoyLCBucGNUZXguaGVpZ2h0KjIpO1xuICAgICAgICBiYXRjaC5kcmF3KG5wY1RleCwgMzAwK2FuaW0sIDE1MCwgbnBjVGV4LndpZHRoKjIsIG5wY1RleC5oZWlnaHQqMik7XG5cbiAgICAgICAgYmF0Y2guZW5kKCk7XG5cbiAgICAgICAgLy9zdG9wIHJlbmRlcmluZyB0byBGQk8sIGFuZCBzdGFydCByZW5kZXJpbmcgdG8gc2NyZWVuXG4gICAgICAgIGZiby5lbmQoKTtcblxuXG4gICAgICAgIC8vY2xlYXIgdGhlIHNjcmVlblxuICAgICAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUKTtcbiAgICAgICAgXG4gICAgICAgIGJhdGNoLnNoYWRlciA9IHNob2Nrd2F2ZVNoYWRlcjtcbiAgICAgICAgYmF0Y2gucmVzaXplKGZiby53aWR0aCwgZmJvLmhlaWdodCk7XG4gICAgICAgIGJhdGNoLmJlZ2luKCk7XG5cbiAgICAgICAgc2hvY2t3YXZlU2hhZGVyLnNldFVuaWZvcm1mKFwic2hvY2tQYXJhbXNcIiwgMTAuMCwgMC43LCAwLjEpO1xuICAgICAgICBzaG9ja3dhdmVTaGFkZXIuc2V0VW5pZm9ybWYoXCJjZW50ZXJcIiwgbW91c2VYLCBtb3VzZVkpO1xuICAgICAgICBzaG9ja3dhdmVTaGFkZXIuc2V0VW5pZm9ybWYoXCJ0aW1lXCIsIHRpbWUgKz0gMC4wMjUpO1xuXG4gICAgICAgIGJhdGNoLmRyYXdSZWdpb24oZmJvVGV4UmVnaW9uLCAwLCAwKTtcbiAgICAgICAgYmF0Y2guZW5kKCk7XG4gICAgfVxuXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlbmRlcik7XG59KTsiXX0=
