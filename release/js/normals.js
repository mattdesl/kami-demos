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
				
		
		//TODO: make these public
		this._blendSrc = this.context.gl.ONE;
		this._blendDst = this.context.gl.ONE_MINUS_SRC_ALPHA
		this._blendEnabled = true;
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
	 * If three or more arguments are specified, this method assumes that RGB 
	 * or RGBA float values (0.0 to 1.0) are being passed. 
	 * 
	 * If less than three arguments are specified, we only consider the first 
	 * and assign it to all four components -- this is useful for setting transparency 
	 * in a premultiplied alpha stage.
	 *
	 * @method  setColor
	 * @param {Number} r the red component, normalized
	 * @param {Number} g the green component, normalized
	 * @param {Number} b the blue component, normalized
	 * @param {Number} a the alpha component, normalized
	 */
	setColor: function(r, g, b, a) {
		if (arguments.length >= 3) {
			//default alpha to one 
			a = (a || a === 0) ? a : 1.0;
		} else {
			r = g = b = a = (arguments[0] || 0);
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
	 * Called after flushing the batch. This method
	 * does nothing by default.
	 *
	 * @method  _postRender
	 */
	_postRender: function() {
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

		var gl = this.gl;
		
		this._preRender();

		//number of sprites in batch
		var numComponents = this.getVertexSize();
		var spriteCount = (this.idx / (numComponents * 4));
		
		//draw the sprites
		var gl = this.context.gl;
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
		this.vertices = [];
		this.indices = [];
		this.size = this.maxVertices = 0;

		if (this.defaultShader)
			this.defaultShader.destroy();
		this.defaultShader = null;
		this._shader = null; // remove reference to whatever shader is currently being used

		if (this.mesh) 
			this.mesh.destroy();
		this.mesh = null;
	}
});

module.exports = BaseBatch;

},{"./glutils/Mesh":9,"klasse":12,"number-util":13}],4:[function(require,module,exports){
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
			new Mesh.Attrib("Position", 2),
			 //pack the color using some crazy wizardry 
			new Mesh.Attrib("Color", 4, null, gl.UNSIGNED_BYTE, true, 1),
			new Mesh.Attrib("TexCoord0", 2)
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

		//premultiplied alpha
		if (this._blendEnabled) {
			gl.enable(gl.BLEND);

			//set either to -1 if you want to call your own 
			//blendFunc or blendFuncSeparate
			if (this._blendSrc !== -1 && this._blendDst !== -1)
				gl.blendFunc(this._blendSrc, this._blendDst); 
		}
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

		if (this._blendEnabled)
			gl.disable(gl.BLEND);
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
	"attribute vec2 Position;",
	"attribute vec4 Color;",
	"attribute vec2 TexCoord0;",

	"uniform vec2 u_projection;",
	"varying vec2 vTexCoord0;",
	"varying vec4 vColor;",

	"void main(void) {",
	"   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);",
	"   vTexCoord0 = TexCoord0;",
	"   vColor = Color;",
	"}"
].join('\n');

module.exports = SpriteBatch;

},{"./BaseBatch":3,"./glutils/Mesh":9,"./glutils/ShaderProgram":10,"klasse":12}],5:[function(require,module,exports){
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

//Unmanaged textures:
//	HTML elements like Image, Video, Canvas
//	pixels buffer from Canvas
//	pixels array

//Need special handling:
//  context.onContextLost.add(function() {
//  	createDynamicTexture();
//  }.bind(this));

//Managed textures:
//	images specified with a path
//	this will use Image under the hood


module.exports = Texture;
},{"klasse":12,"number-util":13,"signals":14}],6:[function(require,module,exports){
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
},{"./Texture":5,"klasse":12}],7:[function(require,module,exports){
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
			if (obj && typeof obj.destroy)
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
},{"klasse":12,"signals":14}],8:[function(require,module,exports){
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
		this.texture = null;
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
},{"../Texture":5,"klasse":12}],9:[function(require,module,exports){
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
		 * @property
		 * @private
		 */
		this._vertexStride = null;

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
		this._vertexStride = totalNumComponents * 4; // in bytes

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
		this.vertices = [];
		this.indices = [];
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
		var stride = this._vertexStride;

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
},{"klasse":12}],10:[function(require,module,exports){
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
	}
});

module.exports = ShaderProgram;
},{"klasse":12}],11:[function(require,module,exports){
/**
  Auto-generated Kami index file.
  Created on 2013-12-23.
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
 * 
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
},{}],13:[function(require,module,exports){
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
	return (n & (n - 1)) == 0;
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
},{}],14:[function(require,module,exports){
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
var ShaderProgram = require('kami').ShaderProgram;
var fs = require('fs');

//include polyfill for requestAnimationFrame
require('raf.js');

var vert = "//incoming Position attribute from our SpriteBatch\nattribute vec2 Position;\nattribute vec4 Color;\nattribute vec2 TexCoord0;\nuniform vec2 u_projection;\nvarying vec2 vTexCoord0;\nvarying vec4 vColor;\n\nvoid main(void) {\n   gl_Position = vec4( Position.x / u_projection.x - 1.0, Position.y / -u_projection.y + 1.0 , 0.0, 1.0);\n   vTexCoord0 = TexCoord0;\n   vColor = Color;\n}";
var frag = "#ifdef GL_ES\nprecision mediump float;\n#endif\n\n//fixed number of lights\n#define N_LIGHTS 2\n\n//attributes from vertex shader\nvarying vec4 vColor;\nvarying vec2 vTexCoord0;\n\n//our texture samplers\nuniform sampler2D u_texture0;   //diffuse map\nuniform sampler2D u_normals;   //normal map\n\n//values used for shading algorithm...\nuniform vec2 Resolution;      //resolution of canvas\nuniform vec4 AmbientColor;    //ambient RGBA -- alpha is intensity \n\nuniform vec3 LightPos[N_LIGHTS];     //light position, normalized\nuniform vec4 LightColor[N_LIGHTS];   //light RGBA -- alpha is intensity\nuniform vec3 Falloff[N_LIGHTS];      //attenuation coefficients\n\n// uniform float Test[2];\n\nvoid main() {\n\t//RGBA of our diffuse color\n\tvec4 DiffuseColor = texture2D(u_texture0, vTexCoord0);\n\t\n\t//RGB of our normal map\n\tvec3 NormalMap = texture2D(u_normals, vTexCoord0).rgb;\n\t\n\tvec3 Sum = vec3(0.0);\n\n\tfor (int i=0; i<N_LIGHTS; i++) {\n\t\t//The delta position of light\n\t\tvec3 LightDir = vec3(LightPos[i].xy - (gl_FragCoord.xy / Resolution.xy), LightPos[i].z);\n\t\t\n\t\t//Correct for aspect ratio\n\t\tLightDir.x *= Resolution.x / Resolution.y;\n\t\t\n\t\t//Determine distance (used for attenuation) BEFORE we normalize our LightDir\n\t\tfloat D = length(LightDir);\n\t\t\n\t\t//normalize our vectors\n\t\tvec3 N = normalize(NormalMap * 2.0 - 1.0);\n\t\tvec3 L = normalize(LightDir);\n\t\t\n\t\t//Some normal maps may need to be inverted like so:\n\t\t// N.y = 1.0 - N.y;\n\n\t\t//Pre-multiply light color with intensity\n\t\t//Then perform \"N dot L\" to determine our diffuse term\n\t\tvec3 Diffuse = (LightColor[i].rgb * LightColor[i].a) * max(dot(N, L), 0.0);\n\n\t\t//pre-multiply ambient color with intensity\n\t\tvec3 Ambient = AmbientColor.rgb * AmbientColor.a;\n\t\t\n\t\t//calculate attenuation\n\t\tfloat Attenuation = 1.0 / ( Falloff[i].x + (Falloff[i].y*D) + (Falloff[i].z*D*D) );\n\t\t\n\t\t//the calculation which brings it all together\n\t\tvec3 Intensity = Ambient + Diffuse * Attenuation;\n\t\tvec3 FinalColor = DiffuseColor.rgb * Intensity;\n\n\t\tSum += FinalColor;\n\t}\n\n\tgl_FragColor = vColor * vec4(Sum, DiffuseColor.a);\n}";

function addCredits() {
    var text = document.createElement("div");
    text.className = "credits";
    text.innerHTML = 
                '<div><a href="https://github.com/mattdesl/kami-demos">kami-demos</a></div>'
                + 'brick wall texture and normal map by <a href="http://opengameart.org/content/brick-wall">JosipKladaric</a>';
    document.body.appendChild(text);
}


domready(function() {
    //Create a new WebGL canvas with the given size
    var context = new WebGLContext(window.innerWidth, window.innerHeight);

    //the 'view' is the DOM canvas, so we can just append it to our body
    document.body.appendChild( context.view );
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";

    addCredits();

    //We use SpriteBatch to draw textures as 2D quads
    var batch = new SpriteBatch(context);
    
    var texDiffuse = new Texture(context, "img/brick-diffuse.png");
    var texNormal  = new Texture(context, "img/brick-normals.png");

    //set the filters for our textures
    texNormal.setWrap(Texture.Wrap.REPEAT);
    texNormal.setFilter(Texture.Filter.LINEAR);

    texDiffuse.setWrap(Texture.Wrap.REPEAT);    
    texDiffuse.setFilter(Texture.Filter.LINEAR);

    //setup our shader
    var shader = new ShaderProgram(context, vert, frag);
    if (shader.log)
        console.warn(shader.log);

    //notice how we bind our shader before setting uniforms!
    shader.bind();
    shader.setUniformi("u_normals", 1);

    //parameters for the lighting shader
    var ambientColor = new Float32Array([0.0, 0.0, 0.0, 0.2]);

    //the default light Z position
    var lightZ = 0.075;

    //these parameters are per-light
    var lightColor = new Float32Array(
            [1.0, 1.0, 1.0, 1.0,
             0.6, 0.8, 0.5, 0.5]);
    var falloff = new Float32Array(
            [0.4, 7.0, 40.0,
             0.2, 1.0, 40.0]);
    var lightPos = new Float32Array(
            [0, 0, lightZ,
             0, 0, lightZ]);

    var mouse = {x:0, y:0},
        scroll = 0,
        time   = 0;
    
    window.addEventListener("mousemove", function(ev) {
        mouse.x = ev.pageX / context.width;
        mouse.y = 1.0 - ev.pageY / context.height;
    }, true);

    window.addEventListener("resize", function(ev) {
        context.resize(window.innerWidth, window.innerHeight);
    }, true);

    var lastTime = 0,
        now = Date.now();

    function render() {
        requestAnimationFrame(render);
        
        //get delta time for smooth animation
        now = Date.now();
        var delta = (now - lastTime) / 1000;
        lastTime = now;

        var gl = context.gl;


        //animate the camera by scrolling UV offsets
        time += 0.25 * delta;

        //we can scale the coordinates to create a "zoom"        
        var zoom = 1 - ( (Math.sin(time) / 2 + 0.5) * 0.15 );

        //determine how many repeats we need to fit nicely within the window 
        var xrepeats = (context.width / texDiffuse.width) * zoom;
        var yrepeats = (context.height / texDiffuse.height) * zoom;

        //now offset the position of the UVs with some sin magic
        var xpos = -xrepeats + Math.sin(Math.sin(time*0.5)), 
            ypos = -yrepeats + Math.sin(time*0.25);


        //get the GL rendering context
        var gl = context.gl;

        //clear the context
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        //we need to set the shader of our batch...
        batch.shader = shader;

        //make sure our batch is oriented with the window size
        batch.resize(window.innerWidth, window.innerHeight);

        //draw our image to the size of the canvas
        //this will bind our shader
        batch.begin();

        //the first light will be based on mouse
        lightPos[0] = mouse.x;
        lightPos[1] = mouse.y;

        //the second light we'll just move around a bit
        lightPos[3] = (Math.sin(time*0.25) / 2.0 + 0.5);
        lightPos[4] = (Math.sin(time*0.75) / 2.0 + 0.5);

        //pass our parameters to the shader
        shader.setUniformf("Resolution", context.width, context.height);
        shader.setUniformfv("AmbientColor", ambientColor);

        //note that these are arrays, and we need to explicitly say the component count
        shader.setUniformfv("LightPos[0]", lightPos, 3);
        shader.setUniformfv("Falloff[0]", falloff, 3);
        shader.setUniformfv("LightColor[0]", lightColor, 4);

        texNormal.bind(1);  //bind normals to unit 1
        texDiffuse.bind(0); //bind diffuse to unit 0

        

        batch.draw(texDiffuse, 0, 0, context.width, context.height,
                               xpos, ypos, xpos+xrepeats, ypos+yrepeats);
            
        batch.end(); 
    }

    requestAnimationFrame(render);
});
},{"domready":2,"fs":1,"kami":11,"raf.js":15}]},{},[16])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9fZW1wdHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMvZG9tcmVhZHkvcmVhZHkuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvQmFzZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1Nwcml0ZUJhdGNoLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL1RleHR1cmUuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvVGV4dHVyZVJlZ2lvbi5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9XZWJHTENvbnRleHQuanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9GcmFtZUJ1ZmZlci5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL2xpYi9nbHV0aWxzL01lc2guanMiLCIvcHJvamVjdHMvbnBtdXRpbHMva2FtaS1kZW1vcy9ub2RlX21vZHVsZXMva2FtaS9saWIvZ2x1dGlscy9TaGFkZXJQcm9ncmFtLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbGliL2luZGV4LmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvbm9kZV9tb2R1bGVzL2thbWkvbm9kZV9tb2R1bGVzL2tsYXNzZS9pbmRleC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL25vZGVfbW9kdWxlcy9udW1iZXItdXRpbC9pbmRleC5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9rYW1pL25vZGVfbW9kdWxlcy9zaWduYWxzL2Rpc3Qvc2lnbmFscy5qcyIsIi9wcm9qZWN0cy9ucG11dGlscy9rYW1pLWRlbW9zL25vZGVfbW9kdWxlcy9yYWYuanMvcmFmLmpzIiwiL3Byb2plY3RzL25wbXV0aWxzL2thbWktZGVtb3Mvc3JjL25vcm1hbHMvbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzljQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL21CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOU9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzViQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3YkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOltudWxsLCIvKiFcbiAgKiBkb21yZWFkeSAoYykgRHVzdGluIERpYXogMjAxMiAtIExpY2Vuc2UgTUlUXG4gICovXG4hZnVuY3Rpb24gKG5hbWUsIGRlZmluaXRpb24pIHtcbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT0gJ3VuZGVmaW5lZCcpIG1vZHVsZS5leHBvcnRzID0gZGVmaW5pdGlvbigpXG4gIGVsc2UgaWYgKHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JykgZGVmaW5lKGRlZmluaXRpb24pXG4gIGVsc2UgdGhpc1tuYW1lXSA9IGRlZmluaXRpb24oKVxufSgnZG9tcmVhZHknLCBmdW5jdGlvbiAocmVhZHkpIHtcblxuICB2YXIgZm5zID0gW10sIGZuLCBmID0gZmFsc2VcbiAgICAsIGRvYyA9IGRvY3VtZW50XG4gICAgLCB0ZXN0RWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50XG4gICAgLCBoYWNrID0gdGVzdEVsLmRvU2Nyb2xsXG4gICAgLCBkb21Db250ZW50TG9hZGVkID0gJ0RPTUNvbnRlbnRMb2FkZWQnXG4gICAgLCBhZGRFdmVudExpc3RlbmVyID0gJ2FkZEV2ZW50TGlzdGVuZXInXG4gICAgLCBvbnJlYWR5c3RhdGVjaGFuZ2UgPSAnb25yZWFkeXN0YXRlY2hhbmdlJ1xuICAgICwgcmVhZHlTdGF0ZSA9ICdyZWFkeVN0YXRlJ1xuICAgICwgbG9hZGVkUmd4ID0gaGFjayA/IC9ebG9hZGVkfF5jLyA6IC9ebG9hZGVkfGMvXG4gICAgLCBsb2FkZWQgPSBsb2FkZWRSZ3gudGVzdChkb2NbcmVhZHlTdGF0ZV0pXG5cbiAgZnVuY3Rpb24gZmx1c2goZikge1xuICAgIGxvYWRlZCA9IDFcbiAgICB3aGlsZSAoZiA9IGZucy5zaGlmdCgpKSBmKClcbiAgfVxuXG4gIGRvY1thZGRFdmVudExpc3RlbmVyXSAmJiBkb2NbYWRkRXZlbnRMaXN0ZW5lcl0oZG9tQ29udGVudExvYWRlZCwgZm4gPSBmdW5jdGlvbiAoKSB7XG4gICAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoZG9tQ29udGVudExvYWRlZCwgZm4sIGYpXG4gICAgZmx1c2goKVxuICB9LCBmKVxuXG5cbiAgaGFjayAmJiBkb2MuYXR0YWNoRXZlbnQob25yZWFkeXN0YXRlY2hhbmdlLCBmbiA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoL15jLy50ZXN0KGRvY1tyZWFkeVN0YXRlXSkpIHtcbiAgICAgIGRvYy5kZXRhY2hFdmVudChvbnJlYWR5c3RhdGVjaGFuZ2UsIGZuKVxuICAgICAgZmx1c2goKVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gKHJlYWR5ID0gaGFjayA/XG4gICAgZnVuY3Rpb24gKGZuKSB7XG4gICAgICBzZWxmICE9IHRvcCA/XG4gICAgICAgIGxvYWRlZCA/IGZuKCkgOiBmbnMucHVzaChmbikgOlxuICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRlc3RFbC5kb1Njcm9sbCgnbGVmdCcpXG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IHJlYWR5KGZuKSB9LCA1MClcbiAgICAgICAgICB9XG4gICAgICAgICAgZm4oKVxuICAgICAgICB9KClcbiAgICB9IDpcbiAgICBmdW5jdGlvbiAoZm4pIHtcbiAgICAgIGxvYWRlZCA/IGZuKCkgOiBmbnMucHVzaChmbilcbiAgICB9KVxufSlcbiIsIi8qKlxuICogVGhlIGNvcmUga2FtaSBtb2R1bGUgcHJvdmlkZXMgYmFzaWMgMkQgc3ByaXRlIGJhdGNoaW5nIGFuZCBcbiAqIGFzc2V0IG1hbmFnZW1lbnQuXG4gKiBcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIE1lc2ggPSByZXF1aXJlKCcuL2dsdXRpbHMvTWVzaCcpO1xuXG52YXIgY29sb3JUb0Zsb2F0ID0gcmVxdWlyZSgnbnVtYmVyLXV0aWwnKS5jb2xvclRvRmxvYXQ7XG5cbi8qKiBcbiAqIEEgYmF0Y2hlciBtaXhpbiBjb21wb3NlZCBvZiBxdWFkcyAodHdvIHRyaXMsIGluZGV4ZWQpLiBcbiAqXG4gKiBUaGlzIGlzIHVzZWQgaW50ZXJuYWxseTsgdXNlcnMgc2hvdWxkIGxvb2sgYXQgXG4gKiB7eyNjcm9zc0xpbmsgXCJTcHJpdGVCYXRjaFwifX17ey9jcm9zc0xpbmt9fSBpbnN0ZWFkLCB3aGljaCBpbmhlcml0cyBmcm9tIHRoaXNcbiAqIGNsYXNzLlxuICogXG4gKiBUaGUgYmF0Y2hlciBpdHNlbGYgaXMgbm90IG1hbmFnZWQgYnkgV2ViR0xDb250ZXh0OyBob3dldmVyLCBpdCBtYWtlc1xuICogdXNlIG9mIE1lc2ggYW5kIFRleHR1cmUgd2hpY2ggd2lsbCBiZSBtYW5hZ2VkLiBGb3IgdGhpcyByZWFzb24sIHRoZSBiYXRjaGVyXG4gKiBkb2VzIG5vdCBob2xkIGEgZGlyZWN0IHJlZmVyZW5jZSB0byB0aGUgR0wgc3RhdGUuXG4gKlxuICogU3ViY2xhc3NlcyBtdXN0IGltcGxlbWVudCB0aGUgZm9sbG93aW5nOiAgXG4gKiB7eyNjcm9zc0xpbmsgXCJCYXNlQmF0Y2gvX2NyZWF0ZVNoYWRlcjptZXRob2RcIn19e3svY3Jvc3NMaW5rfX0gIFxuICoge3sjY3Jvc3NMaW5rIFwiQmFzZUJhdGNoL19jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOm1ldGhvZFwifX17ey9jcm9zc0xpbmt9fSAgXG4gKiB7eyNjcm9zc0xpbmsgXCJCYXNlQmF0Y2gvZ2V0VmVydGV4U2l6ZTptZXRob2RcIn19e3svY3Jvc3NMaW5rfX0gIFxuICogXG4gKiBAY2xhc3MgIEJhc2VCYXRjaFxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1dlYkdMQ29udGV4dH0gY29udGV4dCB0aGUgY29udGV4dCB0aGlzIGJhdGNoZXIgYmVsb25ncyB0b1xuICogQHBhcmFtIHtOdW1iZXJ9IHNpemUgdGhlIG9wdGlvbmFsIHNpemUgb2YgdGhpcyBiYXRjaCwgaS5lLiBtYXggbnVtYmVyIG9mIHF1YWRzXG4gKiBAZGVmYXVsdCAgNTAwXG4gKi9cbnZhciBCYXNlQmF0Y2ggPSBuZXcgQ2xhc3Moe1xuXG5cdC8vQ29uc3RydWN0b3Jcblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gQmFzZUJhdGNoKGNvbnRleHQsIHNpemUpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBTcHJpdGVCYXRjaFwiO1xuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHR0aGlzLnNpemUgPSBzaXplIHx8IDUwMDtcblx0XHRcblx0XHQvLyA2NTUzNSBpcyBtYXggaW5kZXgsIHNvIDY1NTM1IC8gNiA9IDEwOTIyLlxuXHRcdGlmICh0aGlzLnNpemUgPiAxMDkyMikgIC8vKHlvdSdkIGhhdmUgdG8gYmUgaW5zYW5lIHRvIHRyeSBhbmQgYmF0Y2ggdGhpcyBtdWNoIHdpdGggV2ViR0wpXG5cdFx0XHR0aHJvdyBcIkNhbid0IGhhdmUgbW9yZSB0aGFuIDEwOTIyIHNwcml0ZXMgcGVyIGJhdGNoOiBcIiArIHRoaXMuc2l6ZTtcblx0XHRcdFx0XG5cdFx0XG5cdFx0Ly9UT0RPOiBtYWtlIHRoZXNlIHB1YmxpY1xuXHRcdHRoaXMuX2JsZW5kU3JjID0gdGhpcy5jb250ZXh0LmdsLk9ORTtcblx0XHR0aGlzLl9ibGVuZERzdCA9IHRoaXMuY29udGV4dC5nbC5PTkVfTUlOVVNfU1JDX0FMUEhBXG5cdFx0dGhpcy5fYmxlbmRFbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLl9zaGFkZXIgPSB0aGlzLl9jcmVhdGVTaGFkZXIoKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoaXMgc2hhZGVyIHdpbGwgYmUgdXNlZCB3aGVuZXZlciBcIm51bGxcIiBpcyBwYXNzZWRcblx0XHQgKiBhcyB0aGUgYmF0Y2gncyBzaGFkZXIuIFxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IHtTaGFkZXJQcm9ncmFtfSBzaGFkZXJcblx0XHQgKi9cblx0XHR0aGlzLmRlZmF1bHRTaGFkZXIgPSB0aGlzLl9zaGFkZXI7XG5cblx0XHQvKipcblx0XHQgKiBCeSBkZWZhdWx0LCBhIFNwcml0ZUJhdGNoIGlzIGNyZWF0ZWQgd2l0aCBpdHMgb3duIFNoYWRlclByb2dyYW0sXG5cdFx0ICogc3RvcmVkIGluIGBkZWZhdWx0U2hhZGVyYC4gSWYgdGhpcyBmbGFnIGlzIHRydWUsIG9uIGRlbGV0aW5nIHRoZSBTcHJpdGVCYXRjaCwgaXRzXG5cdFx0ICogYGRlZmF1bHRTaGFkZXJgIHdpbGwgYWxzbyBiZSBkZWxldGVkLiBJZiB0aGlzIGZsYWcgaXMgZmFsc2UsIG5vIHNoYWRlcnNcblx0XHQgKiB3aWxsIGJlIGRlbGV0ZWQgb24gZGVzdHJveS5cblx0XHQgKlxuXHRcdCAqIE5vdGUgdGhhdCBpZiB5b3UgcmUtYXNzaWduIGBkZWZhdWx0U2hhZGVyYCwgeW91IHdpbGwgbmVlZCB0byBkaXNwb3NlIHRoZSBwcmV2aW91c1xuXHRcdCAqIGRlZmF1bHQgc2hhZGVyIHlvdXJzZWwuIFxuXHRcdCAqXG5cdFx0ICogQHByb3BlcnR5IG93bnNTaGFkZXJcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKi9cblx0XHR0aGlzLm93bnNTaGFkZXIgPSB0cnVlO1xuXG5cdFx0dGhpcy5pZHggPSAwO1xuXHRcdHRoaXMuZHJhd2luZyA9IGZhbHNlO1xuXG5cdFx0dGhpcy5tZXNoID0gdGhpcy5fY3JlYXRlTWVzaCh0aGlzLnNpemUpO1xuXG5cblx0XHQvKipcblx0XHQgKiBUaGUgQUJHUiBwYWNrZWQgY29sb3IsIGFzIGEgc2luZ2xlIGZsb2F0LiBUaGUgZGVmYXVsdFxuXHRcdCAqIHZhbHVlIGlzIHRoZSBjb2xvciB3aGl0ZSAoMjU1LCAyNTUsIDI1NSwgMjU1KS5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB7TnVtYmVyfSBjb2xvclxuXHRcdCAqIEByZWFkT25seSBcblx0XHQgKi9cblx0XHR0aGlzLmNvbG9yID0gY29sb3JUb0Zsb2F0KDI1NSwgMjU1LCAyNTUsIDI1NSk7XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogV2hldGhlciB0byBwcmVtdWx0aXBseSBhbHBoYSBvbiBjYWxscyB0byBzZXRDb2xvci4gXG5cdFx0ICogVGhpcyBpcyB0cnVlIGJ5IGRlZmF1bHQsIHNvIHRoYXQgd2UgY2FuIGNvbnZlbmllbnRseSB3cml0ZTpcblx0XHQgKlxuXHRcdCAqICAgICBiYXRjaC5zZXRDb2xvcigxLCAwLCAwLCAwLjI1KTsgLy90aW50cyByZWQgd2l0aCAyNSUgb3BhY2l0eVxuXHRcdCAqXG5cdFx0ICogSWYgZmFsc2UsIHlvdSBtdXN0IHByZW11bHRpcGx5IHRoZSBjb2xvcnMgeW91cnNlbGYgdG8gYWNoaWV2ZVxuXHRcdCAqIHRoZSBzYW1lIHRpbnQsIGxpa2Ugc286XG5cdFx0ICpcblx0XHQgKiAgICAgYmF0Y2guc2V0Q29sb3IoMC4yNSwgMCwgMCwgMC4yNSk7XG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHByZW11bHRpcGxpZWRcblx0XHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0XHQgKiBAZGVmYXVsdCAgdHJ1ZVxuXHRcdCAqL1xuXHRcdHRoaXMucHJlbXVsdGlwbGllZCA9IHRydWU7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBzZXR0ZXIvZ2V0dGVyIGZvciB0aGlzIGJhdGNoJ3MgY3VycmVudCBTaGFkZXJQcm9ncmFtLlxuXHQgKiBJZiB0aGlzIGlzIHNldCB3aGVuIHRoZSBiYXRjaCBpcyBkcmF3aW5nLCB0aGUgc3RhdGUgd2lsbCBiZSBmbHVzaGVkXG5cdCAqIHRvIHRoZSBHUFUgYW5kIHRoZSBuZXcgc2hhZGVyIHdpbGwgdGhlbiBiZSBib3VuZC5cblx0ICpcblx0ICogSWYgYG51bGxgIG9yIGEgZmFsc3kgdmFsdWUgaXMgc3BlY2lmaWVkLCB0aGUgYmF0Y2gncyBgZGVmYXVsdFNoYWRlcmAgd2lsbCBiZSB1c2VkLiBcblx0ICpcblx0ICogTm90ZSB0aGF0IHNoYWRlcnMgYXJlIGJvdW5kIG9uIGJhdGNoLmJlZ2luKCkuXG5cdCAqXG5cdCAqIEBwcm9wZXJ0eSBzaGFkZXJcblx0ICogQHR5cGUge1NoYWRlclByb2dyYW19XG5cdCAqL1xuXHRzaGFkZXI6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dmFyIHdhc0RyYXdpbmcgPSB0aGlzLmRyYXdpbmc7XG5cblx0XHRcdGlmICh3YXNEcmF3aW5nKSB7XG5cdFx0XHRcdHRoaXMuZW5kKCk7IC8vdW5iaW5kcyB0aGUgc2hhZGVyIGZyb20gdGhlIG1lc2hcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fc2hhZGVyID0gdmFsID8gdmFsIDogdGhpcy5kZWZhdWx0U2hhZGVyO1xuXG5cdFx0XHRpZiAod2FzRHJhd2luZykge1xuXHRcdFx0XHR0aGlzLmJlZ2luKCk7XG5cdFx0XHR9XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2hhZGVyO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgY29sb3Igb2YgdGhpcyBzcHJpdGUgYmF0Y2hlciwgd2hpY2ggaXMgdXNlZCBpbiBzdWJzZXF1ZW50IGRyYXdcblx0ICogY2FsbHMuIFRoaXMgZG9lcyBub3QgZmx1c2ggdGhlIGJhdGNoLlxuXHQgKlxuXHQgKiBJZiB0aHJlZSBvciBtb3JlIGFyZ3VtZW50cyBhcmUgc3BlY2lmaWVkLCB0aGlzIG1ldGhvZCBhc3N1bWVzIHRoYXQgUkdCIFxuXHQgKiBvciBSR0JBIGZsb2F0IHZhbHVlcyAoMC4wIHRvIDEuMCkgYXJlIGJlaW5nIHBhc3NlZC4gXG5cdCAqIFxuXHQgKiBJZiBsZXNzIHRoYW4gdGhyZWUgYXJndW1lbnRzIGFyZSBzcGVjaWZpZWQsIHdlIG9ubHkgY29uc2lkZXIgdGhlIGZpcnN0IFxuXHQgKiBhbmQgYXNzaWduIGl0IHRvIGFsbCBmb3VyIGNvbXBvbmVudHMgLS0gdGhpcyBpcyB1c2VmdWwgZm9yIHNldHRpbmcgdHJhbnNwYXJlbmN5IFxuXHQgKiBpbiBhIHByZW11bHRpcGxpZWQgYWxwaGEgc3RhZ2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldENvbG9yXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSByZWQgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBncmVlbiBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIGJsdWUgY29tcG9uZW50LCBub3JtYWxpemVkXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBhbHBoYSBjb21wb25lbnQsIG5vcm1hbGl6ZWRcblx0ICovXG5cdHNldENvbG9yOiBmdW5jdGlvbihyLCBnLCBiLCBhKSB7XG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykge1xuXHRcdFx0Ly9kZWZhdWx0IGFscGhhIHRvIG9uZSBcblx0XHRcdGEgPSAoYSB8fCBhID09PSAwKSA/IGEgOiAxLjA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHIgPSBnID0gYiA9IGEgPSAoYXJndW1lbnRzWzBdIHx8IDApO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByZW11bHRpcGxpZWQpIHtcblx0XHRcdHIgKj0gYTtcblx0XHRcdGcgKj0gYTtcblx0XHRcdGIgKj0gYTtcblx0XHR9XG5cdFx0XG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yVG9GbG9hdChcblx0XHRcdH5+KHIgKiAyNTUpLFxuXHRcdFx0fn4oZyAqIDI1NSksXG5cdFx0XHR+fihiICogMjU1KSxcblx0XHRcdH5+KGEgKiAyNTUpXG5cdFx0KTtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIGZyb20gdGhlIGNvbnN0cnVjdG9yIHRvIGNyZWF0ZSBhIG5ldyBNZXNoIFxuXHQgKiBiYXNlZCBvbiB0aGUgZXhwZWN0ZWQgYmF0Y2ggc2l6ZS4gU2hvdWxkIHNldCB1cFxuXHQgKiB2ZXJ0cyAmIGluZGljZXMgcHJvcGVybHkuXG5cdCAqXG5cdCAqIFVzZXJzIHNob3VsZCBub3QgY2FsbCB0aGlzIGRpcmVjdGx5OyBpbnN0ZWFkLCBpdFxuXHQgKiBzaG91bGQgb25seSBiZSBpbXBsZW1lbnRlZCBieSBzdWJjbGFzc2VzLlxuXHQgKiBcblx0ICogQG1ldGhvZCBfY3JlYXRlTWVzaFxuXHQgKiBAcGFyYW0ge051bWJlcn0gc2l6ZSB0aGUgc2l6ZSBwYXNzZWQgdGhyb3VnaCB0aGUgY29uc3RydWN0b3Jcblx0ICovXG5cdF9jcmVhdGVNZXNoOiBmdW5jdGlvbihzaXplKSB7XG5cdFx0Ly90aGUgdG90YWwgbnVtYmVyIG9mIGZsb2F0cyBpbiBvdXIgYmF0Y2hcblx0XHR2YXIgbnVtVmVydHMgPSBzaXplICogNCAqIHRoaXMuZ2V0VmVydGV4U2l6ZSgpO1xuXHRcdC8vdGhlIHRvdGFsIG51bWJlciBvZiBpbmRpY2VzIGluIG91ciBiYXRjaFxuXHRcdHZhciBudW1JbmRpY2VzID0gc2l6ZSAqIDY7XG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXG5cdFx0Ly92ZXJ0ZXggZGF0YVxuXHRcdHRoaXMudmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KG51bVZlcnRzKTtcblx0XHQvL2luZGV4IGRhdGFcblx0XHR0aGlzLmluZGljZXMgPSBuZXcgVWludDE2QXJyYXkobnVtSW5kaWNlcyk7IFxuXHRcdFxuXHRcdGZvciAodmFyIGk9MCwgaj0wOyBpIDwgbnVtSW5kaWNlczsgaSArPSA2LCBqICs9IDQpIFxuXHRcdHtcblx0XHRcdHRoaXMuaW5kaWNlc1tpICsgMF0gPSBqICsgMDsgXG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDFdID0gaiArIDE7XG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDJdID0gaiArIDI7XG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDNdID0gaiArIDA7XG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDRdID0gaiArIDI7XG5cdFx0XHR0aGlzLmluZGljZXNbaSArIDVdID0gaiArIDM7XG5cdFx0fVxuXG5cdFx0dmFyIG1lc2ggPSBuZXcgTWVzaCh0aGlzLmNvbnRleHQsIGZhbHNlLCBcblx0XHRcdFx0XHRcdG51bVZlcnRzLCBudW1JbmRpY2VzLCB0aGlzLl9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzKCkpO1xuXHRcdG1lc2gudmVydGljZXMgPSB0aGlzLnZlcnRpY2VzO1xuXHRcdG1lc2guaW5kaWNlcyA9IHRoaXMuaW5kaWNlcztcblx0XHRtZXNoLnZlcnRleFVzYWdlID0gZ2wuRFlOQU1JQ19EUkFXO1xuXHRcdG1lc2guaW5kZXhVc2FnZSA9IGdsLlNUQVRJQ19EUkFXO1xuXHRcdG1lc2guZGlydHkgPSB0cnVlO1xuXHRcdHJldHVybiBtZXNoO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc2hhZGVyIGZvciB0aGlzIGJhdGNoLiBJZiB5b3UgcGxhbiB0byBzdXBwb3J0XG5cdCAqIG11bHRpcGxlIGluc3RhbmNlcyBvZiB5b3VyIGJhdGNoLCBpdCBtYXkgb3IgbWF5IG5vdCBiZSB3aXNlXG5cdCAqIHRvIHVzZSBhIHNoYXJlZCBzaGFkZXIgdG8gc2F2ZSByZXNvdXJjZXMuXG5cdCAqIFxuXHQgKiBUaGlzIG1ldGhvZCBpbml0aWFsbHkgdGhyb3dzIGFuIGVycm9yOyBzbyBpdCBtdXN0IGJlIG92ZXJyaWRkZW4gYnlcblx0ICogc3ViY2xhc3NlcyBvZiBCYXNlQmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9jcmVhdGVTaGFkZXJcblx0ICogQHJldHVybiB7TnVtYmVyfSB0aGUgc2l6ZSBvZiBhIHZlcnRleCwgaW4gIyBvZiBmbG9hdHNcblx0ICovXG5cdF9jcmVhdGVTaGFkZXI6IGZ1bmN0aW9uKCkge1xuXHRcdHRocm93IFwiX2NyZWF0ZVNoYWRlciBub3QgaW1wbGVtZW50ZWRcIlxuXHR9LFx0XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2YgdmVydGV4IGF0dHJpYnV0ZXMgZm9yIHRoaXMgbWVzaDsgXG5cdCAqIHN1YmNsYXNzZXMgc2hvdWxkIGltcGxlbWVudCB0aGlzIHdpdGggdGhlIGF0dHJpYnV0ZXMgXG5cdCAqIGV4cGVjdGVkIGZvciB0aGVpciBiYXRjaC5cblx0ICpcblx0ICogVGhpcyBtZXRob2QgaW5pdGlhbGx5IHRocm93cyBhbiBlcnJvcjsgc28gaXQgbXVzdCBiZSBvdmVycmlkZGVuIGJ5XG5cdCAqIHN1YmNsYXNzZXMgb2YgQmFzZUJhdGNoLlxuXHQgKlxuXHQgKiBAbWV0aG9kIF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzXG5cdCAqIEByZXR1cm4ge0FycmF5fSBhbiBhcnJheSBvZiBNZXNoLlZlcnRleEF0dHJpYiBvYmplY3RzXG5cdCAqL1xuXHRfY3JlYXRlVmVydGV4QXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG5cdFx0dGhyb3cgXCJfY3JlYXRlVmVydGV4QXR0cmlidXRlcyBub3QgaW1wbGVtZW50ZWRcIjtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXggZm9yIHRoaXMgYmF0Y2hlci5cblx0ICogXG5cdCAqIFRoaXMgbWV0aG9kIGluaXRpYWxseSB0aHJvd3MgYW4gZXJyb3I7IHNvIGl0IG11c3QgYmUgb3ZlcnJpZGRlbiBieVxuXHQgKiBzdWJjbGFzc2VzIG9mIEJhc2VCYXRjaC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VmVydGV4U2l6ZVxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IHRoZSBzaXplIG9mIGEgdmVydGV4LCBpbiAjIG9mIGZsb2F0c1xuXHQgKi9cblx0Z2V0VmVydGV4U2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhyb3cgXCJnZXRWZXJ0ZXhTaXplIG5vdCBpbXBsZW1lbnRlZFwiO1xuXHR9LFxuXG5cdFxuXHQvKiogXG5cdCAqIEJlZ2lucyB0aGUgc3ByaXRlIGJhdGNoLiBUaGlzIHdpbGwgYmluZCB0aGUgc2hhZGVyXG5cdCAqIGFuZCBtZXNoLiBTdWJjbGFzc2VzIG1heSB3YW50IHRvIGRpc2FibGUgZGVwdGggb3IgXG5cdCAqIHNldCB1cCBibGVuZGluZy5cblx0ICpcblx0ICogQG1ldGhvZCAgYmVnaW5cblx0ICovXG5cdGJlZ2luOiBmdW5jdGlvbigpICB7XG5cdFx0aWYgKHRoaXMuZHJhd2luZykgXG5cdFx0XHR0aHJvdyBcImJhdGNoLmVuZCgpIG11c3QgYmUgY2FsbGVkIGJlZm9yZSBiZWdpblwiO1xuXHRcdHRoaXMuZHJhd2luZyA9IHRydWU7XG5cblx0XHR0aGlzLnNoYWRlci5iaW5kKCk7XG5cblx0XHQvL2JpbmQgdGhlIGF0dHJpYnV0ZXMgbm93IHRvIGF2b2lkIHJlZHVuZGFudCBjYWxsc1xuXHRcdHRoaXMubWVzaC5iaW5kKHRoaXMuc2hhZGVyKTtcblx0fSxcblxuXHQvKiogXG5cdCAqIEVuZHMgdGhlIHNwcml0ZSBiYXRjaC4gVGhpcyB3aWxsIGZsdXNoIGFueSByZW1haW5pbmcgXG5cdCAqIGRhdGEgYW5kIHNldCBHTCBzdGF0ZSBiYWNrIHRvIG5vcm1hbC5cblx0ICogXG5cdCAqIEBtZXRob2QgIGVuZFxuXHQgKi9cblx0ZW5kOiBmdW5jdGlvbigpICB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcImJhdGNoLmJlZ2luKCkgbXVzdCBiZSBjYWxsZWQgYmVmb3JlIGVuZFwiO1xuXHRcdGlmICh0aGlzLmlkeCA+IDApXG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0dGhpcy5kcmF3aW5nID0gZmFsc2U7XG5cblx0XHR0aGlzLm1lc2gudW5iaW5kKHRoaXMuc2hhZGVyKTtcblx0fSxcblxuXHQvKiogXG5cdCAqIENhbGxlZCBiZWZvcmUgcmVuZGVyaW5nIHRvIGJpbmQgbmV3IHRleHR1cmVzLlxuXHQgKiBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgYnkgZGVmYXVsdC5cblx0ICpcblx0ICogQG1ldGhvZCAgX3ByZVJlbmRlclxuXHQgKi9cblx0X3ByZVJlbmRlcjogZnVuY3Rpb24oKSAge1xuXHR9LFxuXG5cdC8qKiBcblx0ICogQ2FsbGVkIGFmdGVyIGZsdXNoaW5nIHRoZSBiYXRjaC4gVGhpcyBtZXRob2Rcblx0ICogZG9lcyBub3RoaW5nIGJ5IGRlZmF1bHQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9wb3N0UmVuZGVyXG5cdCAqL1xuXHRfcG9zdFJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEZsdXNoZXMgdGhlIGJhdGNoIGJ5IHB1c2hpbmcgdGhlIGN1cnJlbnQgZGF0YVxuXHQgKiB0byBHTC5cblx0ICogXG5cdCAqIEBtZXRob2QgZmx1c2hcblx0ICovXG5cdGZsdXNoOiBmdW5jdGlvbigpICB7XG5cdFx0aWYgKHRoaXMuaWR4PT09MClcblx0XHRcdHJldHVybjtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0XG5cdFx0dGhpcy5fcHJlUmVuZGVyKCk7XG5cblx0XHQvL251bWJlciBvZiBzcHJpdGVzIGluIGJhdGNoXG5cdFx0dmFyIG51bUNvbXBvbmVudHMgPSB0aGlzLmdldFZlcnRleFNpemUoKTtcblx0XHR2YXIgc3ByaXRlQ291bnQgPSAodGhpcy5pZHggLyAobnVtQ29tcG9uZW50cyAqIDQpKTtcblx0XHRcblx0XHQvL2RyYXcgdGhlIHNwcml0ZXNcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0dGhpcy5tZXNoLnZlcnRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMubWVzaC5kcmF3KGdsLlRSSUFOR0xFUywgc3ByaXRlQ291bnQgKiA2LCAwLCB0aGlzLmlkeCk7XG5cblx0XHR0aGlzLmlkeCA9IDA7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzcHJpdGUgdG8gdGhpcyBiYXRjaC5cblx0ICogVGhlIHNwZWNpZmljcyBkZXBlbmQgb24gdGhlIHNwcml0ZSBiYXRjaCBpbXBsZW1lbnRhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCBkcmF3XG5cdCAqIEBwYXJhbSAge1RleHR1cmV9IHRleHR1cmUgdGhlIHRleHR1cmUgZm9yIHRoaXMgc3ByaXRlXG5cdCAqIEBwYXJhbSAge051bWJlcn0geCAgICAgICB0aGUgeCBwb3NpdGlvbiwgZGVmYXVsdHMgdG8gemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHkgICAgICAgdGhlIHkgcG9zaXRpb24sIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgIHRoZSB3aWR0aCwgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgd2lkdGhcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgIHRoZSBoZWlnaHQsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIGhlaWdodFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUxICAgICAgdGhlIGZpcnN0IFUgY29vcmRpbmF0ZSwgZGVmYXVsdCB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjEgICAgICB0aGUgZmlyc3QgViBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB1MiAgICAgIHRoZSBzZWNvbmQgVSBjb29yZGluYXRlLCBkZWZhdWx0IG9uZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHYyICAgICAgdGhlIHNlY29uZCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqL1xuXHRkcmF3OiBmdW5jdGlvbih0ZXh0dXJlLCB4LCB5LCB3aWR0aCwgaGVpZ2h0LCB1MSwgdjEsIHUyLCB2Mikge1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc2luZ2xlIHF1YWQgbWVzaCB0byB0aGlzIHNwcml0ZSBiYXRjaCBmcm9tIHRoZSBnaXZlblxuXHQgKiBhcnJheSBvZiB2ZXJ0aWNlcy5cblx0ICogVGhlIHNwZWNpZmljcyBkZXBlbmQgb24gdGhlIHNwcml0ZSBiYXRjaCBpbXBsZW1lbnRhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZHJhd1ZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgdGV4dHVyZSB3ZSBhcmUgZHJhd2luZyBmb3IgdGhpcyBzcHJpdGVcblx0ICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IHZlcnRzIGFuIGFycmF5IG9mIHZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBvZmYgdGhlIG9mZnNldCBpbnRvIHRoZSB2ZXJ0aWNlcyBhcnJheSB0byByZWFkIGZyb21cblx0ICovXG5cdGRyYXdWZXJ0aWNlczogZnVuY3Rpb24odGV4dHVyZSwgdmVydHMsIG9mZikgIHtcblx0fSxcblxuXHRkcmF3UmVnaW9uOiBmdW5jdGlvbihyZWdpb24sIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLmRyYXcocmVnaW9uLnRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHJlZ2lvbi51LCByZWdpb24udiwgcmVnaW9uLnUyLCByZWdpb24udjIpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGUgYmF0Y2gsIGRlbGV0aW5nIGl0cyBidWZmZXJzIGFuZCByZW1vdmluZyBpdCBmcm9tIHRoZVxuXHQgKiBXZWJHTENvbnRleHQgbWFuYWdlbWVudC4gVHJ5aW5nIHRvIHVzZSB0aGlzXG5cdCAqIGJhdGNoIGFmdGVyIGRlc3Ryb3lpbmcgaXQgY2FuIGxlYWQgdG8gdW5wcmVkaWN0YWJsZSBiZWhhdmlvdXIuXG5cdCAqXG5cdCAqIElmIGBvd25zU2hhZGVyYCBpcyB0cnVlLCB0aGlzIHdpbGwgYWxzbyBkZWxldGUgdGhlIGBkZWZhdWx0U2hhZGVyYCBvYmplY3QuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMudmVydGljZXMgPSBbXTtcblx0XHR0aGlzLmluZGljZXMgPSBbXTtcblx0XHR0aGlzLnNpemUgPSB0aGlzLm1heFZlcnRpY2VzID0gMDtcblxuXHRcdGlmICh0aGlzLmRlZmF1bHRTaGFkZXIpXG5cdFx0XHR0aGlzLmRlZmF1bHRTaGFkZXIuZGVzdHJveSgpO1xuXHRcdHRoaXMuZGVmYXVsdFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5fc2hhZGVyID0gbnVsbDsgLy8gcmVtb3ZlIHJlZmVyZW5jZSB0byB3aGF0ZXZlciBzaGFkZXIgaXMgY3VycmVudGx5IGJlaW5nIHVzZWRcblxuXHRcdGlmICh0aGlzLm1lc2gpIFxuXHRcdFx0dGhpcy5tZXNoLmRlc3Ryb3koKTtcblx0XHR0aGlzLm1lc2ggPSBudWxsO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlQmF0Y2g7XG4iLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbi8vIFJlcXVpcmVzLi4uLlxudmFyIENsYXNzICAgICAgICAgPSByZXF1aXJlKCdrbGFzc2UnKTtcblxudmFyIEJhc2VCYXRjaCA9IHJlcXVpcmUoJy4vQmFzZUJhdGNoJyk7XG5cbnZhciBNZXNoICAgICAgICAgID0gcmVxdWlyZSgnLi9nbHV0aWxzL01lc2gnKTtcbnZhciBTaGFkZXJQcm9ncmFtID0gcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0nKTtcblxuLyoqXG4gKiBBIGJhc2ljIGltcGxlbWVudGF0aW9uIG9mIGEgYmF0Y2hlciB3aGljaCBkcmF3cyAyRCBzcHJpdGVzLlxuICogVGhpcyB1c2VzIHR3byB0cmlhbmdsZXMgKHF1YWRzKSB3aXRoIGluZGV4ZWQgYW5kIGludGVybGVhdmVkXG4gKiB2ZXJ0ZXggZGF0YS4gRWFjaCB2ZXJ0ZXggaG9sZHMgNSBmbG9hdHMgKFBvc2l0aW9uLnh5LCBDb2xvciwgVGV4Q29vcmQwLnh5KS5cbiAqXG4gKiBUaGUgY29sb3IgaXMgcGFja2VkIGludG8gYSBzaW5nbGUgZmxvYXQgdG8gcmVkdWNlIHZlcnRleCBiYW5kd2lkdGgsIGFuZFxuICogdGhlIGRhdGEgaXMgaW50ZXJsZWF2ZWQgZm9yIGJlc3QgcGVyZm9ybWFuY2UuIFdlIHVzZSBhIHN0YXRpYyBpbmRleCBidWZmZXIsXG4gKiBhbmQgYSBkeW5hbWljIHZlcnRleCBidWZmZXIgdGhhdCBpcyB1cGRhdGVkIHdpdGggYnVmZmVyU3ViRGF0YS4gXG4gKiBcbiAqIEBleGFtcGxlXG4gKiAgICAgIHZhciBTcHJpdGVCYXRjaCA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDsgIFxuICogICAgICBcbiAqICAgICAgLy9jcmVhdGUgYSBuZXcgYmF0Y2hlclxuICogICAgICB2YXIgYmF0Y2ggPSBuZXcgU3ByaXRlQmF0Y2goY29udGV4dCk7XG4gKlxuICogICAgICBmdW5jdGlvbiByZW5kZXIoKSB7XG4gKiAgICAgICAgICBiYXRjaC5iZWdpbigpO1xuICogICAgICAgICAgXG4gKiAgICAgICAgICAvL2RyYXcgc29tZSBzcHJpdGVzIGluIGJldHdlZW4gYmVnaW4gYW5kIGVuZC4uLlxuICogICAgICAgICAgYmF0Y2guZHJhdyggdGV4dHVyZSwgMCwgMCwgMjUsIDMyICk7XG4gKiAgICAgICAgICBiYXRjaC5kcmF3KCB0ZXh0dXJlMSwgMCwgMjUsIDQyLCAyMyApO1xuICogXG4gKiAgICAgICAgICBiYXRjaC5lbmQoKTtcbiAqICAgICAgfVxuICogXG4gKiBAY2xhc3MgIFNwcml0ZUJhdGNoXG4gKiBAdXNlcyBCYXNlQmF0Y2hcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtXZWJHTENvbnRleHR9IGNvbnRleHQgdGhlIGNvbnRleHQgZm9yIHRoaXMgYmF0Y2hcbiAqIEBwYXJhbSB7TnVtYmVyfSBzaXplIHRoZSBtYXggbnVtYmVyIG9mIHNwcml0ZXMgdG8gZml0IGluIGEgc2luZ2xlIGJhdGNoXG4gKi9cbnZhciBTcHJpdGVCYXRjaCA9IG5ldyBDbGFzcyh7XG5cblx0Ly9pbmhlcml0IHNvbWUgc3R1ZmYgb250byB0aGlzIHByb3RvdHlwZVxuXHRNaXhpbnM6IEJhc2VCYXRjaCxcblxuXHQvL0NvbnN0cnVjdG9yXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIFNwcml0ZUJhdGNoKGNvbnRleHQsIHNpemUpIHtcblx0XHRCYXNlQmF0Y2guY2FsbCh0aGlzLCBjb250ZXh0LCBzaXplKTtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBwcm9qZWN0aW9uIEZsb2F0MzJBcnJheSB2ZWMyIHdoaWNoIGlzXG5cdFx0ICogdXNlZCB0byBhdm9pZCBzb21lIG1hdHJpeCBjYWxjdWxhdGlvbnMuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkgcHJvamVjdGlvblxuXHRcdCAqIEB0eXBlIHtGbG9hdDMyQXJyYXl9XG5cdFx0ICovXG5cdFx0dGhpcy5wcm9qZWN0aW9uID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcblxuXHRcdC8vU2V0cyB1cCBhIGRlZmF1bHQgcHJvamVjdGlvbiB2ZWN0b3Igc28gdGhhdCB0aGUgYmF0Y2ggd29ya3Mgd2l0aG91dCBzZXRQcm9qZWN0aW9uXG5cdFx0dGhpcy5wcm9qZWN0aW9uWzBdID0gdGhpcy5jb250ZXh0LndpZHRoLzI7XG5cdFx0dGhpcy5wcm9qZWN0aW9uWzFdID0gdGhpcy5jb250ZXh0LmhlaWdodC8yO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGN1cnJlbnRseSBib3VuZCB0ZXh0dXJlLiBEbyBub3QgbW9kaWZ5LlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB7VGV4dHVyZX0gdGV4dHVyZVxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqL1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBmdW5jdGlvbiB0byBzZXQgdGhlIGJhdGNoJ3MgcHJvamVjdGlvblxuXHQgKiBtYXRyaXggdG8gYW4gb3J0aG9ncmFwaGljIDJEIHByb2plY3Rpb24sIGJhc2VkIG9uIHRoZSBnaXZlbiBzY3JlZW5cblx0ICogc2l6ZS4gVGhpcyBhbGxvd3MgdXNlcnMgdG8gcmVuZGVyIGluIDJEIHdpdGhvdXQgYW55IG5lZWQgZm9yIGEgY2FtZXJhLlxuXHQgKiBcblx0ICogQHBhcmFtICB7W3R5cGVdfSB3aWR0aCAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGhlaWdodCBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdHJlc2l6ZTogZnVuY3Rpb24od2lkdGgsIGhlaWdodCkge1xuXHRcdHRoaXMuc2V0UHJvamVjdGlvbih3aWR0aC8yLCBoZWlnaHQvMik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFRoZSBudW1iZXIgb2YgZmxvYXRzIHBlciB2ZXJ0ZXggZm9yIHRoaXMgYmF0Y2hlciBcblx0ICogKFBvc2l0aW9uLnh5ICsgQ29sb3IgKyBUZXhDb29yZDAueHkpLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRWZXJ0ZXhTaXplXG5cdCAqIEByZXR1cm4ge051bWJlcn0gdGhlIG51bWJlciBvZiBmbG9hdHMgcGVyIHZlcnRleFxuXHQgKi9cblx0Z2V0VmVydGV4U2l6ZTogZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIFNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVc2VkIGludGVybmFsbHkgdG8gcmV0dXJuIHRoZSBQb3NpdGlvbiwgQ29sb3IsIGFuZCBUZXhDb29yZDAgYXR0cmlidXRlcy5cblx0ICpcblx0ICogQG1ldGhvZCAgX2NyZWF0ZVZlcnRleEF0dHJpYnVldHNcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJuIHtbdHlwZV19IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdF9jcmVhdGVWZXJ0ZXhBdHRyaWJ1dGVzOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cblx0XHRyZXR1cm4gWyBcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihcIlBvc2l0aW9uXCIsIDIpLFxuXHRcdFx0IC8vcGFjayB0aGUgY29sb3IgdXNpbmcgc29tZSBjcmF6eSB3aXphcmRyeSBcblx0XHRcdG5ldyBNZXNoLkF0dHJpYihcIkNvbG9yXCIsIDQsIG51bGwsIGdsLlVOU0lHTkVEX0JZVEUsIHRydWUsIDEpLFxuXHRcdFx0bmV3IE1lc2guQXR0cmliKFwiVGV4Q29vcmQwXCIsIDIpXG5cdFx0XTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBTZXRzIHRoZSBwcm9qZWN0aW9uIHZlY3RvciwgYW4geCBhbmQgeVxuXHQgKiBkZWZpbmluZyB0aGUgbWlkZGxlIHBvaW50cyBvZiB5b3VyIHN0YWdlLlxuXHQgKlxuXHQgKiBAbWV0aG9kIHNldFByb2plY3Rpb25cblx0ICogQHBhcmFtIHtOdW1iZXJ9IHggdGhlIHggcHJvamVjdGlvbiB2YWx1ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0geSB0aGUgeSBwcm9qZWN0aW9uIHZhbHVlXG5cdCAqL1xuXHRzZXRQcm9qZWN0aW9uOiBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIG9sZFggPSB0aGlzLnByb2plY3Rpb25bMF07XG5cdFx0dmFyIG9sZFkgPSB0aGlzLnByb2plY3Rpb25bMV07XG5cdFx0dGhpcy5wcm9qZWN0aW9uWzBdID0geDtcblx0XHR0aGlzLnByb2plY3Rpb25bMV0gPSB5O1xuXG5cdFx0Ly93ZSBuZWVkIHRvIGZsdXNoIHRoZSBiYXRjaC4uXG5cdFx0aWYgKHRoaXMuZHJhd2luZyAmJiAoeCAhPSBvbGRYIHx8IHkgIT0gb2xkWSkpIHtcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMuX3VwZGF0ZU1hdHJpY2VzKCk7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgZGVmYXVsdCBzaGFkZXIgZm9yIHRoaXMgYmF0Y2guXG5cdCAqXG5cdCAqIEBtZXRob2QgIF9jcmVhdGVTaGFkZXJcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAcmV0dXJuIHtTaGFkZXJQcm9ncmFtfSBhIG5ldyBpbnN0YW5jZSBvZiBTaGFkZXJQcm9ncmFtXG5cdCAqL1xuXHRfY3JlYXRlU2hhZGVyOiBmdW5jdGlvbigpIHtcblx0XHR2YXIgc2hhZGVyID0gbmV3IFNoYWRlclByb2dyYW0odGhpcy5jb250ZXh0LFxuXHRcdFx0XHRTcHJpdGVCYXRjaC5ERUZBVUxUX1ZFUlRfU0hBREVSLCBcblx0XHRcdFx0U3ByaXRlQmF0Y2guREVGQVVMVF9GUkFHX1NIQURFUik7XG5cdFx0aWYgKHNoYWRlci5sb2cpXG5cdFx0XHRjb25zb2xlLndhcm4oXCJTaGFkZXIgTG9nOlxcblwiICsgc2hhZGVyLmxvZyk7XG5cdFx0cmV0dXJuIHNoYWRlcjtcblx0fSxcblxuXHQvKipcblx0ICogVGhpcyBpcyBjYWxsZWQgZHVyaW5nIHJlbmRlcmluZyB0byB1cGRhdGUgcHJvamVjdGlvbi90cmFuc2Zvcm1cblx0ICogbWF0cmljZXMgYW5kIHVwbG9hZCB0aGUgbmV3IHZhbHVlcyB0byB0aGUgc2hhZGVyLiBGb3IgZXhhbXBsZSxcblx0ICogaWYgdGhlIHVzZXIgY2FsbHMgc2V0UHJvamVjdGlvbiBtaWQtZHJhdywgdGhlIGJhdGNoIHdpbGwgZmx1c2hcblx0ICogYW5kIHRoaXMgd2lsbCBiZSBjYWxsZWQgYmVmb3JlIGNvbnRpbnVpbmcgdG8gYWRkIGl0ZW1zIHRvIHRoZSBiYXRjaC5cblx0ICpcblx0ICogWW91IGdlbmVyYWxseSBzaG91bGQgbm90IG5lZWQgdG8gY2FsbCB0aGlzIGRpcmVjdGx5LlxuXHQgKiBcblx0ICogQG1ldGhvZCAgdXBkYXRlTWF0cmljZXNcblx0ICogQHByb3RlY3RlZFxuXHQgKi9cblx0dXBkYXRlTWF0cmljZXM6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuc2hhZGVyLnNldFVuaWZvcm1mdihcInVfcHJvamVjdGlvblwiLCB0aGlzLnByb2plY3Rpb24pO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgYmVmb3JlIHJlbmRlcmluZywgYW5kIGJpbmRzIHRoZSBjdXJyZW50IHRleHR1cmUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIF9wcmVSZW5kZXJcblx0ICogQHByb3RlY3RlZFxuXHQgKi9cblx0X3ByZVJlbmRlcjogZnVuY3Rpb24oKSB7XG5cdFx0aWYgKHRoaXMudGV4dHVyZSlcblx0XHRcdHRoaXMudGV4dHVyZS5iaW5kKCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEJpbmRzIHRoZSBzaGFkZXIsIGRpc2FibGVzIGRlcHRoIHdyaXRpbmcsIFxuXHQgKiBlbmFibGVzIGJsZW5kaW5nLCBhY3RpdmF0ZXMgdGV4dHVyZSB1bml0IDAsIGFuZCBzZW5kc1xuXHQgKiBkZWZhdWx0IG1hdHJpY2VzIGFuZCBzYW1wbGVyMkQgdW5pZm9ybXMgdG8gdGhlIHNoYWRlci5cblx0ICpcblx0ICogQG1ldGhvZCAgYmVnaW5cblx0ICovXG5cdGJlZ2luOiBmdW5jdGlvbigpIHtcblx0XHQvL3Nwcml0ZSBiYXRjaCBkb2Vzbid0IGhvbGQgYSByZWZlcmVuY2UgdG8gR0wgc2luY2UgaXQgaXMgdm9sYXRpbGVcblx0XHR2YXIgZ2wgPSB0aGlzLmNvbnRleHQuZ2w7XG5cdFx0XG5cdFx0Ly9UaGlzIGJpbmRzIHRoZSBzaGFkZXIgYW5kIG1lc2ghXG5cdFx0QmFzZUJhdGNoLnByb3RvdHlwZS5iZWdpbi5jYWxsKHRoaXMpO1xuXG5cdFx0dGhpcy51cGRhdGVNYXRyaWNlcygpOyAvL3NlbmQgcHJvamVjdGlvbi90cmFuc2Zvcm0gdG8gc2hhZGVyXG5cblx0XHQvL3VwbG9hZCB0aGUgc2FtcGxlciB1bmlmb3JtLiBub3QgbmVjZXNzYXJ5IGV2ZXJ5IGZsdXNoIHNvIHdlIGp1c3Rcblx0XHQvL2RvIGl0IGhlcmUuXG5cdFx0dGhpcy5zaGFkZXIuc2V0VW5pZm9ybWkoXCJ1X3RleHR1cmUwXCIsIDApO1xuXG5cdFx0Ly9kaXNhYmxlIGRlcHRoIG1hc2tcblx0XHRnbC5kZXB0aE1hc2soZmFsc2UpO1xuXG5cdFx0Ly9wcmVtdWx0aXBsaWVkIGFscGhhXG5cdFx0aWYgKHRoaXMuX2JsZW5kRW5hYmxlZCkge1xuXHRcdFx0Z2wuZW5hYmxlKGdsLkJMRU5EKTtcblxuXHRcdFx0Ly9zZXQgZWl0aGVyIHRvIC0xIGlmIHlvdSB3YW50IHRvIGNhbGwgeW91ciBvd24gXG5cdFx0XHQvL2JsZW5kRnVuYyBvciBibGVuZEZ1bmNTZXBhcmF0ZVxuXHRcdFx0aWYgKHRoaXMuX2JsZW5kU3JjICE9PSAtMSAmJiB0aGlzLl9ibGVuZERzdCAhPT0gLTEpXG5cdFx0XHRcdGdsLmJsZW5kRnVuYyh0aGlzLl9ibGVuZFNyYywgdGhpcy5fYmxlbmREc3QpOyBcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIEVuZHMgdGhlIHNwcml0ZSBiYXRjaGVyIGFuZCBmbHVzaGVzIGFueSByZW1haW5pbmcgZGF0YSB0byB0aGUgR1BVLlxuXHQgKiBcblx0ICogQG1ldGhvZCBlbmRcblx0ICovXG5cdGVuZDogZnVuY3Rpb24oKSB7XG5cdFx0Ly9zcHJpdGUgYmF0Y2ggZG9lc24ndCBob2xkIGEgcmVmZXJlbmNlIHRvIEdMIHNpbmNlIGl0IGlzIHZvbGF0aWxlXG5cdFx0dmFyIGdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdFxuXHRcdC8vanVzdCBkbyBkaXJlY3QgcGFyZW50IGNhbGwgZm9yIHNwZWVkIGhlcmVcblx0XHQvL1RoaXMgYmluZHMgdGhlIHNoYWRlciBhbmQgbWVzaCFcblx0XHRCYXNlQmF0Y2gucHJvdG90eXBlLmVuZC5jYWxsKHRoaXMpO1xuXG5cdFx0Z2wuZGVwdGhNYXNrKHRydWUpO1xuXG5cdFx0aWYgKHRoaXMuX2JsZW5kRW5hYmxlZClcblx0XHRcdGdsLmRpc2FibGUoZ2wuQkxFTkQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBGbHVzaGVzIHRoZSBiYXRjaCB0byB0aGUgR1BVLiBUaGlzIHNob3VsZCBiZSBjYWxsZWQgd2hlblxuXHQgKiBzdGF0ZSBjaGFuZ2VzLCBzdWNoIGFzIGJsZW5kIGZ1bmN0aW9ucywgZGVwdGggb3Igc3RlbmNpbCBzdGF0ZXMsXG5cdCAqIHNoYWRlcnMsIGFuZCBzbyBmb3J0aC5cblx0ICogXG5cdCAqIEBtZXRob2QgZmx1c2hcblx0ICovXG5cdGZsdXNoOiBmdW5jdGlvbigpIHtcblx0XHQvL2lnbm9yZSBmbHVzaCBpZiB0ZXh0dXJlIGlzIG51bGwgb3Igb3VyIGJhdGNoIGlzIGVtcHR5XG5cdFx0aWYgKCF0aGlzLnRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cdFx0aWYgKHRoaXMuaWR4ID09PSAwKVxuXHRcdFx0cmV0dXJuO1xuXHRcdEJhc2VCYXRjaC5wcm90b3R5cGUuZmx1c2guY2FsbCh0aGlzKTtcblx0XHRTcHJpdGVCYXRjaC50b3RhbFJlbmRlckNhbGxzKys7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzcHJpdGUgdG8gdGhpcyBiYXRjaC4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGRyYXdcblx0ICogQHBhcmFtICB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHggICAgICAgdGhlIHggcG9zaXRpb24gaW4gcGl4ZWxzLCBkZWZhdWx0cyB0byB6ZXJvXG5cdCAqIEBwYXJhbSAge051bWJlcn0geSAgICAgICB0aGUgeSBwb3NpdGlvbiBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB3aWR0aCAgIHRoZSB3aWR0aCBpbiBwaXhlbHMsIGRlZmF1bHRzIHRvIHRoZSB0ZXh0dXJlIHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICB0aGUgaGVpZ2h0IGluIHBpeGVscywgZGVmYXVsdHMgdG8gdGhlIHRleHR1cmUgaGVpZ2h0XG5cdCAqIEBwYXJhbSAge051bWJlcn0gdTEgICAgICB0aGUgZmlyc3QgVSBjb29yZGluYXRlLCBkZWZhdWx0IHplcm9cblx0ICogQHBhcmFtICB7TnVtYmVyfSB2MSAgICAgIHRoZSBmaXJzdCBWIGNvb3JkaW5hdGUsIGRlZmF1bHQgemVyb1xuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHUyICAgICAgdGhlIHNlY29uZCBVIGNvb3JkaW5hdGUsIGRlZmF1bHQgb25lXG5cdCAqIEBwYXJhbSAge051bWJlcn0gdjIgICAgICB0aGUgc2Vjb25kIFYgY29vcmRpbmF0ZSwgZGVmYXVsdCBvbmVcblx0ICovXG5cdGRyYXc6IGZ1bmN0aW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQsIHUxLCB2MSwgdTIsIHYyKSB7XG5cdFx0aWYgKCF0aGlzLmRyYXdpbmcpXG5cdFx0XHR0aHJvdyBcIklsbGVnYWwgU3RhdGU6IHRyeWluZyB0byBkcmF3IGEgYmF0Y2ggYmVmb3JlIGJlZ2luKClcIjtcblxuXHRcdC8vZG9uJ3QgZHJhdyBhbnl0aGluZyBpZiBHTCB0ZXggZG9lc24ndCBleGlzdC4uXG5cdFx0aWYgKCF0ZXh0dXJlKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0aWYgKHRoaXMudGV4dHVyZSA9PT0gbnVsbCB8fCB0aGlzLnRleHR1cmUuaWQgIT09IHRleHR1cmUuaWQpIHtcblx0XHRcdC8vbmV3IHRleHR1cmUuLiBmbHVzaCBwcmV2aW91cyBkYXRhXG5cdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pZHggPT0gdGhpcy52ZXJ0aWNlcy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZmx1c2goKTsgLy93ZSd2ZSByZWFjaGVkIG91ciBtYXgsIGZsdXNoIGJlZm9yZSBwdXNoaW5nIG1vcmUgZGF0YVxuXHRcdH1cblxuXHRcdHdpZHRoID0gKHdpZHRoPT09MCkgPyB3aWR0aCA6ICh3aWR0aCB8fCB0ZXh0dXJlLndpZHRoKTtcblx0XHRoZWlnaHQgPSAoaGVpZ2h0PT09MCkgPyBoZWlnaHQgOiAoaGVpZ2h0IHx8IHRleHR1cmUuaGVpZ2h0KTtcblx0XHR4ID0geCB8fCAwO1xuXHRcdHkgPSB5IHx8IDA7XG5cblx0XHR2YXIgeDEgPSB4O1xuXHRcdHZhciB4MiA9IHggKyB3aWR0aDtcblx0XHR2YXIgeTEgPSB5O1xuXHRcdHZhciB5MiA9IHkgKyBoZWlnaHQ7XG5cblx0XHR1MSA9IHUxIHx8IDA7XG5cdFx0dTIgPSAodTI9PT0wKSA/IHUyIDogKHUyIHx8IDEpO1xuXHRcdHYxID0gdjEgfHwgMDtcblx0XHR2MiA9ICh2Mj09PTApID8gdjIgOiAodjIgfHwgMSk7XG5cblx0XHR2YXIgYyA9IHRoaXMuY29sb3I7XG5cblx0XHQvL3h5XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHgxO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB5MTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IGM7XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB1MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdjE7XG5cdFx0XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTE7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYxO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4Mjtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTI7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB4MTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0geTI7XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSBjO1xuXHRcdC8vdXZcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdTE7XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHYyO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBBZGRzIGEgc2luZ2xlIHF1YWQgbWVzaCB0byB0aGlzIHNwcml0ZSBiYXRjaCBmcm9tIHRoZSBnaXZlblxuXHQgKiBhcnJheSBvZiB2ZXJ0aWNlcy4gVGhlIHNwcml0ZSBpcyBkcmF3biBpbiBcblx0ICogc2NyZWVuLXNwYWNlIHdpdGggdGhlIG9yaWdpbiBhdCB0aGUgdXBwZXItbGVmdCBjb3JuZXIgKHktZG93bikuXG5cdCAqXG5cdCAqIFRoaXMgcmVhZHMgMjAgaW50ZXJsZWF2ZWQgZmxvYXRzIGZyb20gdGhlIGdpdmVuIG9mZnNldCBpbmRleCwgaW4gdGhlIGZvcm1hdFxuXHQgKlxuXHQgKiAgeyB4LCB5LCBjb2xvciwgdSwgdixcblx0ICogICAgICAuLi4gIH1cblx0ICpcblx0ICogQG1ldGhvZCAgZHJhd1ZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSB0aGUgVGV4dHVyZSBvYmplY3Rcblx0ICogQHBhcmFtIHtGbG9hdDMyQXJyYXl9IHZlcnRzIGFuIGFycmF5IG9mIHZlcnRpY2VzXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBvZmYgdGhlIG9mZnNldCBpbnRvIHRoZSB2ZXJ0aWNlcyBhcnJheSB0byByZWFkIGZyb21cblx0ICovXG5cdGRyYXdWZXJ0aWNlczogZnVuY3Rpb24odGV4dHVyZSwgdmVydHMsIG9mZikge1xuXHRcdGlmICghdGhpcy5kcmF3aW5nKVxuXHRcdFx0dGhyb3cgXCJJbGxlZ2FsIFN0YXRlOiB0cnlpbmcgdG8gZHJhdyBhIGJhdGNoIGJlZm9yZSBiZWdpbigpXCI7XG5cdFx0XG5cdFx0Ly9kb24ndCBkcmF3IGFueXRoaW5nIGlmIEdMIHRleCBkb2Vzbid0IGV4aXN0Li5cblx0XHRpZiAoIXRleHR1cmUpXG5cdFx0XHRyZXR1cm47XG5cblxuXHRcdGlmICh0aGlzLnRleHR1cmUgIT0gdGV4dHVyZSkge1xuXHRcdFx0Ly9uZXcgdGV4dHVyZS4uIGZsdXNoIHByZXZpb3VzIGRhdGFcblx0XHRcdHRoaXMuZmx1c2goKTtcblx0XHRcdHRoaXMudGV4dHVyZSA9IHRleHR1cmU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlkeCA9PSB0aGlzLnZlcnRpY2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5mbHVzaCgpOyAvL3dlJ3ZlIHJlYWNoZWQgb3VyIG1heCwgZmx1c2ggYmVmb3JlIHB1c2hpbmcgbW9yZSBkYXRhXG5cdFx0fVxuXG5cdFx0b2ZmID0gb2ZmIHx8IDA7XG5cdFx0Ly9UT0RPOiB1c2UgYSBsb29wIGhlcmU/XG5cdFx0Ly94eVxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL2NvbG9yXG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHQvL3V2XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdFxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblxuXHRcdC8veHlcblx0XHR0aGlzLnZlcnRpY2VzW3RoaXMuaWR4KytdID0gdmVydHNbb2ZmKytdO1xuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly9jb2xvclxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0Ly91dlxuXHRcdHRoaXMudmVydGljZXNbdGhpcy5pZHgrK10gPSB2ZXJ0c1tvZmYrK107XG5cdFx0dGhpcy52ZXJ0aWNlc1t0aGlzLmlkeCsrXSA9IHZlcnRzW29mZisrXTtcblx0fVxufSk7XG5cbi8qKlxuICogVGhlIGRlZmF1bHQgdmVydGV4IHNpemUsIGkuZS4gbnVtYmVyIG9mIGZsb2F0cyBwZXIgdmVydGV4LlxuICogQGF0dHJpYnV0ZSAgVkVSVEVYX1NJWkVcbiAqIEBzdGF0aWNcbiAqIEBmaW5hbFxuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICA1XG4gKi9cblNwcml0ZUJhdGNoLlZFUlRFWF9TSVpFID0gNTtcblxuLyoqXG4gKiBJbmNyZW1lbnRlZCBhZnRlciBlYWNoIGRyYXcgY2FsbCwgY2FuIGJlIHVzZWQgZm9yIGRlYnVnZ2luZy5cbiAqXG4gKiAgICAgU3ByaXRlQmF0Y2gudG90YWxSZW5kZXJDYWxscyA9IDA7XG4gKlxuICogICAgIC4uLiBkcmF3IHlvdXIgc2NlbmUgLi4uXG4gKlxuICogICAgIGNvbnNvbGUubG9nKFwiRHJhdyBjYWxscyBwZXIgZnJhbWU6XCIsIFNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMpO1xuICpcbiAqIFxuICogQGF0dHJpYnV0ZSAgdG90YWxSZW5kZXJDYWxsc1xuICogQHN0YXRpY1xuICogQHR5cGUge051bWJlcn1cbiAqIEBkZWZhdWx0ICAwXG4gKi9cblNwcml0ZUJhdGNoLnRvdGFsUmVuZGVyQ2FsbHMgPSAwO1xuXG5TcHJpdGVCYXRjaC5ERUZBVUxUX0ZSQUdfU0hBREVSID0gW1xuXHRcInByZWNpc2lvbiBtZWRpdW1wIGZsb2F0O1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cdFwidW5pZm9ybSBzYW1wbGVyMkQgdV90ZXh0dXJlMDtcIixcblxuXHRcInZvaWQgbWFpbih2b2lkKSB7XCIsXG5cdFwiICAgZ2xfRnJhZ0NvbG9yID0gdGV4dHVyZTJEKHVfdGV4dHVyZTAsIHZUZXhDb29yZDApICogdkNvbG9yO1wiLFxuXHRcIn1cIlxuXS5qb2luKCdcXG4nKTtcblxuU3ByaXRlQmF0Y2guREVGQVVMVF9WRVJUX1NIQURFUiA9IFtcblx0XCJhdHRyaWJ1dGUgdmVjMiBQb3NpdGlvbjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjNCBDb2xvcjtcIixcblx0XCJhdHRyaWJ1dGUgdmVjMiBUZXhDb29yZDA7XCIsXG5cblx0XCJ1bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1wiLFxuXHRcInZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1wiLFxuXHRcInZhcnlpbmcgdmVjNCB2Q29sb3I7XCIsXG5cblx0XCJ2b2lkIG1haW4odm9pZCkge1wiLFxuXHRcIiAgIGdsX1Bvc2l0aW9uID0gdmVjNCggUG9zaXRpb24ueCAvIHVfcHJvamVjdGlvbi54IC0gMS4wLCBQb3NpdGlvbi55IC8gLXVfcHJvamVjdGlvbi55ICsgMS4wICwgMC4wLCAxLjApO1wiLFxuXHRcIiAgIHZUZXhDb29yZDAgPSBUZXhDb29yZDA7XCIsXG5cdFwiICAgdkNvbG9yID0gQ29sb3I7XCIsXG5cdFwifVwiXG5dLmpvaW4oJ1xcbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNwcml0ZUJhdGNoO1xuIiwiLyoqXG4gKiBAbW9kdWxlIGthbWlcbiAqL1xuXG52YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBTaWduYWwgPSByZXF1aXJlKCdzaWduYWxzJyk7XG52YXIgbmV4dFBvd2VyT2ZUd28gPSByZXF1aXJlKCdudW1iZXItdXRpbCcpLm5leHRQb3dlck9mVHdvO1xudmFyIGlzUG93ZXJPZlR3byA9IHJlcXVpcmUoJ251bWJlci11dGlsJykuaXNQb3dlck9mVHdvO1xuXG52YXIgVGV4dHVyZSA9IG5ldyBDbGFzcyh7XG5cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyB0ZXh0dXJlIHdpdGggdGhlIG9wdGlvbmFsIHdpZHRoLCBoZWlnaHQsIGFuZCBkYXRhLlxuXHQgKlxuXHQgKiBJZiB0aGUgY29uc3RydWN0b3IgaXMgcGFzc2VkIG5vIHBhcmFtZXRlcnMgb3RoZXIgdGhhbiBXZWJHTENvbnRleHQsIHRoZW5cblx0ICogaXQgd2lsbCBub3QgYmUgaW5pdGlhbGl6ZWQgYW5kIHdpbGwgYmUgbm9uLXJlbmRlcmFibGUuIFlvdSB3aWxsIG5lZWQgdG8gbWFudWFsbHlcblx0ICogdXBsb2FkRGF0YSBvciB1cGxvYWRJbWFnZSB5b3Vyc2VsZi5cblx0ICpcblx0ICogSWYgeW91IHBhc3MgYSB3aWR0aCBhbmQgaGVpZ2h0IGFmdGVyIGNvbnRleHQsIHRoZSB0ZXh0dXJlIHdpbGwgYmUgaW5pdGlhbGl6ZWQgd2l0aCB0aGF0IHNpemVcblx0ICogYW5kIG51bGwgZGF0YSAoZS5nLiB0cmFuc3BhcmVudCBibGFjaykuIElmIHlvdSBhbHNvIHBhc3MgdGhlIGZvcm1hdCBhbmQgZGF0YSwgXG5cdCAqIGl0IHdpbGwgYmUgdXBsb2FkZWQgdG8gdGhlIHRleHR1cmUuIFxuXHQgKlxuXHQgKiBJZiB5b3UgcGFzcyBhIFN0cmluZyBvciBEYXRhIFVSSSBhcyB0aGUgc2Vjb25kIHBhcmFtZXRlcixcblx0ICogdGhpcyBUZXh0dXJlIHdpbGwgbG9hZCBhbiBJbWFnZSBvYmplY3QgYXN5bmNocm9ub3VzbHkuIFRoZSBvcHRpb25hbCB0aGlyZFxuXHQgKiBhbmQgZm91cnRoIHBhcmFtZXRlcnMgYXJlIGNhbGxiYWNrIGZ1bmN0aW9ucyBmb3Igc3VjY2VzcyBhbmQgZmFpbHVyZSwgcmVzcGVjdGl2ZWx5LiBcblx0ICogVGhlIG9wdGlvbmFsIGZpZnJ0aCBwYXJhbWV0ZXIgZm9yIHRoaXMgdmVyc2lvbiBvZiB0aGUgY29uc3RydWN0b3IgaXMgZ2VuTWlwbWFwcywgd2hpY2ggZGVmYXVsdHMgdG8gZmFsc2UuIFxuXHQgKiBcblx0ICogVGhlIGFyZ3VtZW50cyBhcmUga2VwdCBpbiBtZW1vcnkgZm9yIGZ1dHVyZSBjb250ZXh0IHJlc3RvcmF0aW9uIGV2ZW50cy4gSWZcblx0ICogdGhpcyBpcyB1bmRlc2lyYWJsZSAoZS5nLiBodWdlIGJ1ZmZlcnMgd2hpY2ggbmVlZCB0byBiZSBHQydkKSwgeW91IHNob3VsZCBub3Rcblx0ICogcGFzcyB0aGUgZGF0YSBpbiB0aGUgY29uc3RydWN0b3IsIGJ1dCBpbnN0ZWFkIHVwbG9hZCBpdCBhZnRlciBjcmVhdGluZyBhbiB1bmluaXRpYWxpemVkIFxuXHQgKiB0ZXh0dXJlLiBZb3Ugd2lsbCBuZWVkIHRvIG1hbmFnZSBpdCB5b3Vyc2VsZiwgZWl0aGVyIGJ5IGV4dGVuZGluZyB0aGUgY3JlYXRlKCkgbWV0aG9kLCBcblx0ICogb3IgbGlzdGVuaW5nIHRvIHJlc3RvcmVkIGV2ZW50cyBpbiBXZWJHTENvbnRleHQuXG5cdCAqXG5cdCAqIE1vc3QgdXNlcnMgd2lsbCB3YW50IHRvIHVzZSB0aGUgQXNzZXRNYW5hZ2VyIHRvIGNyZWF0ZSBhbmQgbWFuYWdlIHRoZWlyIHRleHR1cmVzXG5cdCAqIHdpdGggYXN5bmNocm9ub3VzIGxvYWRpbmcgYW5kIGNvbnRleHQgbG9zcy4gXG5cdCAqXG5cdCAqIEBleGFtcGxlXG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCAyNTYsIDI1Nik7IC8vZW1wdHkgMjU2eDI1NiB0ZXh0dXJlXG5cdCAqIFx0XHRuZXcgVGV4dHVyZShjb250ZXh0LCAxLCAxLCBUZXh0dXJlLkZvcm1hdC5SR0JBLCBUZXh0dXJlLkRhdGFUeXBlLlVOU0lHTkVEX0JZVEUsIFxuXHQgKiBcdFx0XHRcdFx0bmV3IFVpbnQ4QXJyYXkoWzI1NSwwLDAsMjU1XSkpOyAvLzF4MSByZWQgdGV4dHVyZVxuXHQgKiBcdFx0bmV3IFRleHR1cmUoY29udGV4dCwgXCJ0ZXN0LnBuZ1wiKTsgLy9sb2FkcyBpbWFnZSBhc3luY2hyb25vdXNseVxuXHQgKiBcdFx0bmV3IFRleHR1cmUoY29udGV4dCwgXCJ0ZXN0LnBuZ1wiLCBzdWNjZXNzRnVuYywgZmFpbEZ1bmMsIHVzZU1pcG1hcHMpOyAvL2V4dHJhIHBhcmFtcyBmb3IgaW1hZ2UgbGFvZGVyIFxuXHQgKlxuXHQgKiBAY2xhc3MgIFRleHR1cmVcblx0ICogQGNvbnN0cnVjdG9yXG5cdCAqIEBwYXJhbSAge1dlYkdMQ29udGV4dH0gY29udGV4dCB0aGUgV2ViR0wgY29udGV4dFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoIHRoZSB3aWR0aCBvZiB0aGlzIHRleHR1cmVcblx0ICogQHBhcmFtICB7TnVtYmVyfSBoZWlnaHQgdGhlIGhlaWdodCBvZiB0aGlzIHRleHR1cmVcblx0ICogQHBhcmFtICB7R0xlbnVtfSBmb3JtYXQgZS5nLiBUZXh0dXJlLkZvcm1hdC5SR0JBXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZGF0YVR5cGUgZS5nLiBUZXh0dXJlLkRhdGFUeXBlLlVOU0lHTkVEX0JZVEUgKFVpbnQ4QXJyYXkpXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZGF0YSB0aGUgYXJyYXkgYnVmZmVyLCBlLmcuIGEgVWludDhBcnJheSB2aWV3XG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGdlbk1pcG1hcHMgd2hldGhlciB0byBnZW5lcmF0ZSBtaXBtYXBzIGFmdGVyIHVwbG9hZGluZyB0aGUgZGF0YVxuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gVGV4dHVyZShjb250ZXh0LCB3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIGRhdGFUeXBlLCBkYXRhLCBnZW5NaXBtYXBzKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0ICE9PSBcIm9iamVjdFwiKVxuXHRcdFx0dGhyb3cgXCJHTCBjb250ZXh0IG5vdCBzcGVjaWZpZWQgdG8gVGV4dHVyZVwiO1xuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgV2ViR0xUZXh0dXJlIHdoaWNoIGJhY2tzIHRoaXMgVGV4dHVyZSBvYmplY3QuIFRoaXNcblx0XHQgKiBjYW4gYmUgdXNlZCBmb3IgbG93LWxldmVsIEdMIGNhbGxzLlxuXHRcdCAqIFxuXHRcdCAqIEB0eXBlIHtXZWJHTFRleHR1cmV9XG5cdFx0ICovXG5cdFx0dGhpcy5pZCA9IG51bGw7IC8vaW5pdGlhbGl6ZWQgaW4gY3JlYXRlKClcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSB0YXJnZXQgZm9yIHRoaXMgdGV4dHVyZSB1bml0LCBpLmUuIFRFWFRVUkVfMkQuIFN1YmNsYXNzZXNcblx0XHQgKiBzaG91bGQgb3ZlcnJpZGUgdGhlIGNyZWF0ZSgpIG1ldGhvZCB0byBjaGFuZ2UgdGhpcywgZm9yIGNvcnJlY3Rcblx0XHQgKiB1c2FnZSB3aXRoIGNvbnRleHQgcmVzdG9yZS5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkgdGFyZ2V0XG5cdFx0ICogQHR5cGUge0dMZW51bX1cblx0XHQgKiBAZGVmYXVsdCAgZ2wuVEVYVFVSRV8yRFxuXHRcdCAqL1xuXHRcdHRoaXMudGFyZ2V0ID0gY29udGV4dC5nbC5URVhUVVJFXzJEO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHdpZHRoIG9mIHRoaXMgdGV4dHVyZSwgaW4gcGl4ZWxzLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSB3aWR0aFxuXHRcdCAqIEByZWFkT25seVxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9IHRoZSB3aWR0aFxuXHRcdCAqL1xuXHRcdHRoaXMud2lkdGggPSAwOyAvL2luaXRpYWxpemVkIG9uIHRleHR1cmUgdXBsb2FkXG5cblx0XHQvKipcblx0XHQgKiBUaGUgaGVpZ2h0IG9mIHRoaXMgdGV4dHVyZSwgaW4gcGl4ZWxzLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBoZWlnaHRcblx0XHQgKiBAcmVhZE9ubHlcblx0XHQgKiBAdHlwZSB7TnVtYmVyfSB0aGUgaGVpZ2h0XG5cdFx0ICovXG5cdFx0dGhpcy5oZWlnaHQgPSAwOyAvL2luaXRpYWxpemVkIG9uIHRleHR1cmUgdXBsb2FkXG5cblx0XHQvLyBlLmcuIC0tPiBuZXcgVGV4dHVyZShnbCwgMjU2LCAyNTYsIGdsLlJHQiwgZ2wuVU5TSUdORURfQllURSwgZGF0YSk7XG5cdFx0Ly9cdFx0ICAgICAgY3JlYXRlcyBhIG5ldyBlbXB0eSB0ZXh0dXJlLCAyNTZ4MjU2XG5cdFx0Ly9cdFx0LS0+IG5ldyBUZXh0dXJlKGdsKTtcblx0XHQvL1x0XHRcdCAgY3JlYXRlcyBhIG5ldyB0ZXh0dXJlIGJ1dCBXSVRIT1VUIHVwbG9hZGluZyBhbnkgZGF0YS4gXG5cblx0XHQvKipcblx0XHQgKiBUaGUgUyB3cmFwIHBhcmFtZXRlci5cblx0XHQgKiBAcHJvcGVydHkge0dMZW51bX0gd3JhcFNcblx0XHQgKi9cblx0XHR0aGlzLndyYXBTID0gVGV4dHVyZS5ERUZBVUxUX1dSQVA7XG5cdFx0LyoqXG5cdFx0ICogVGhlIFQgd3JhcCBwYXJhbWV0ZXIuXG5cdFx0ICogQHByb3BlcnR5IHtHTGVudW19IHdyYXBUXG5cdFx0ICovXG5cdFx0dGhpcy53cmFwVCA9IFRleHR1cmUuREVGQVVMVF9XUkFQO1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBtaW5pZmNhdGlvbiBmaWx0ZXIuXG5cdFx0ICogQHByb3BlcnR5IHtHTGVudW19IG1pbkZpbHRlciBcblx0XHQgKi9cblx0XHR0aGlzLm1pbkZpbHRlciA9IFRleHR1cmUuREVGQVVMVF9GSUxURVI7XG5cdFx0XG5cdFx0LyoqXG5cdFx0ICogVGhlIG1hZ25pZmljYXRpb24gZmlsdGVyLlxuXHRcdCAqIEBwcm9wZXJ0eSB7R0xlbnVtfSBtYWdGaWx0ZXIgXG5cdFx0ICovXG5cdFx0dGhpcy5tYWdGaWx0ZXIgPSBUZXh0dXJlLkRFRkFVTFRfRklMVEVSO1xuXG5cdFx0LyoqXG5cdFx0ICogV2hlbiBhIHRleHR1cmUgaXMgY3JlYXRlZCwgd2Uga2VlcCB0cmFjayBvZiB0aGUgYXJndW1lbnRzIHByb3ZpZGVkIHRvIFxuXHRcdCAqIGl0cyBjb25zdHJ1Y3Rvci4gT24gY29udGV4dCBsb3NzIGFuZCByZXN0b3JlLCB0aGVzZSBhcmd1bWVudHMgYXJlIHJlLXN1cHBsaWVkXG5cdFx0ICogdG8gdGhlIFRleHR1cmUsIHNvIGFzIHRvIHJlLWNyZWF0ZSBpdCBpbiBpdHMgY29ycmVjdCBmb3JtLlxuXHRcdCAqXG5cdFx0ICogVGhpcyBpcyBtYWlubHkgdXNlZnVsIGlmIHlvdSBhcmUgcHJvY2VkdXJhbGx5IGNyZWF0aW5nIHRleHR1cmVzIGFuZCBwYXNzaW5nXG5cdFx0ICogdGhlaXIgZGF0YSBkaXJlY3RseSAoZS5nLiBmb3IgZ2VuZXJpYyBsb29rdXAgdGFibGVzIGluIGEgc2hhZGVyKS4gRm9yIGltYWdlXG5cdFx0ICogb3IgbWVkaWEgYmFzZWQgdGV4dHVyZXMsIGl0IHdvdWxkIGJlIGJldHRlciB0byB1c2UgYW4gQXNzZXRNYW5hZ2VyIHRvIG1hbmFnZVxuXHRcdCAqIHRoZSBhc3luY2hyb25vdXMgdGV4dHVyZSB1cGxvYWQuXG5cdFx0ICpcblx0XHQgKiBVcG9uIGRlc3Ryb3lpbmcgYSB0ZXh0dXJlLCBhIHJlZmVyZW5jZSB0byB0aGlzIGlzIGFsc28gbG9zdC5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSBtYW5hZ2VkQXJnc1xuXHRcdCAqIEB0eXBlIHtBcnJheX0gdGhlIGFycmF5IG9mIGFyZ3VtZW50cywgc2hpZnRlZCB0byBleGNsdWRlIHRoZSBXZWJHTENvbnRleHQgcGFyYW1ldGVyXG5cdFx0ICovXG5cdFx0dGhpcy5tYW5hZ2VkQXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cblx0XHQvL1RoaXMgaXMgbWFhbmdlZCBieSBXZWJHTENvbnRleHRcblx0XHR0aGlzLmNvbnRleHQuYWRkTWFuYWdlZE9iamVjdCh0aGlzKTtcblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBUaGlzIGNhbiBiZSBjYWxsZWQgYWZ0ZXIgY3JlYXRpbmcgYSBUZXh0dXJlIHRvIGxvYWQgYW4gSW1hZ2Ugb2JqZWN0IGFzeW5jaHJvbm91c2x5LFxuXHQgKiBvciB1cGxvYWQgaW1hZ2UgZGF0YSBkaXJlY3RseS4gSXQgdGFrZXMgdGhlIHNhbWUgcGFyYW1ldGVycyBhcyB0aGUgY29uc3RydWN0b3IsIGV4Y2VwdCBcblx0ICogZm9yIHRoZSBjb250ZXh0IHdoaWNoIGhhcyBhbHJlYWR5IGJlZW4gZXN0YWJsaXNoZWQuIFxuXHQgKlxuXHQgKiBVc2VycyB3aWxsIGdlbmVyYWxseSBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuIFxuXHQgKiBcblx0ICogQHByb3RlY3RlZFxuXHQgKiBAbWV0aG9kICBzZXR1cFxuXHQgKi9cblx0c2V0dXA6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgZGF0YVR5cGUsIGRhdGEsIGdlbk1pcG1hcHMpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0Ly9JZiB0aGUgZmlyc3QgYXJndW1lbnQgaXMgYSBzdHJpbmcsIGFzc3VtZSBpdCdzIGFuIEltYWdlIGxvYWRlclxuXHRcdC8vc2Vjb25kIGFyZ3VtZW50IHdpbGwgdGhlbiBiZSBnZW5NaXBtYXBzLCB0aGlyZCBhbmQgZm91cnRoIHRoZSBzdWNjZXNzL2ZhaWwgY2FsbGJhY2tzXG5cdFx0aWYgKHR5cGVvZiB3aWR0aCA9PT0gXCJzdHJpbmdcIikge1xuXHRcdFx0dmFyIGltZyA9IG5ldyBJbWFnZSgpO1xuXHRcdFx0dmFyIHBhdGggICAgICA9IGFyZ3VtZW50c1swXTsgICAvL2ZpcnN0IGFyZ3VtZW50LCB0aGUgcGF0aFxuXHRcdFx0dmFyIHN1Y2Nlc3NDQiA9IHR5cGVvZiBhcmd1bWVudHNbMV0gPT09IFwiZnVuY3Rpb25cIiA/IGFyZ3VtZW50c1sxXSA6IG51bGw7XG5cdFx0XHR2YXIgZmFpbENCICAgID0gdHlwZW9mIGFyZ3VtZW50c1syXSA9PT0gXCJmdW5jdGlvblwiID8gYXJndW1lbnRzWzJdIDogbnVsbDtcblx0XHRcdGdlbk1pcG1hcHMgICAgPSAhIWFyZ3VtZW50c1szXTtcblxuXHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHQvL0lmIHlvdSB0cnkgdG8gcmVuZGVyIGEgdGV4dHVyZSB0aGF0IGlzIG5vdCB5ZXQgXCJyZW5kZXJhYmxlXCIgKGkuZS4gdGhlIFxuXHRcdFx0Ly9hc3luYyBsb2FkIGhhc24ndCBjb21wbGV0ZWQgeWV0LCB3aGljaCBpcyBhbHdheXMgdGhlIGNhc2UgaW4gQ2hyb21lIHNpbmNlIHJlcXVlc3RBbmltYXRpb25GcmFtZVxuXHRcdFx0Ly9maXJlcyBiZWZvcmUgaW1nLm9ubG9hZCksIFdlYkdMIHdpbGwgdGhyb3cgdXMgZXJyb3JzLiBTbyBpbnN0ZWFkIHdlIHdpbGwganVzdCB1cGxvYWQgc29tZVxuXHRcdFx0Ly9kdW1teSBkYXRhIHVudGlsIHRoZSB0ZXh0dXJlIGxvYWQgaXMgY29tcGxldGUuIFVzZXJzIGNhbiBkaXNhYmxlIHRoaXMgd2l0aCB0aGUgZ2xvYmFsIGZsYWcuXG5cdFx0XHRpZiAoVGV4dHVyZS5VU0VfRFVNTVlfMXgxX0RBVEEpIHtcblx0XHRcdFx0c2VsZi51cGxvYWREYXRhKDEsIDEpO1xuXHRcdFx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwO1xuXHRcdFx0fVxuXG5cdFx0XHRpbWcub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHNlbGYudXBsb2FkSW1hZ2UoaW1nLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZ2VuTWlwbWFwcyk7XG5cdFx0XHRcdGlmIChzdWNjZXNzQ0IpXG5cdFx0XHRcdFx0c3VjY2Vzc0NCKCk7XG5cdFx0XHR9XG5cdFx0XHRpbWcub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBjb25zb2xlLndhcm4oXCJFcnJvciBsb2FkaW5nIGltYWdlOiBcIitwYXRoKTtcblx0XHRcdFx0aWYgKGdlbk1pcG1hcHMpIC8vd2Ugc3RpbGwgbmVlZCB0byBnZW4gbWlwbWFwcyBvbiB0aGUgMXgxIGR1bW15XG5cdFx0XHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAoZ2wuVEVYVFVSRV8yRCk7XG5cdFx0XHRcdGlmIChmYWlsQ0IpXG5cdFx0XHRcdFx0ZmFpbENCKCk7XG5cdFx0XHR9XG5cdFx0XHRpbWcub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBjb25zb2xlLndhcm4oXCJJbWFnZSBsb2FkIGFib3J0ZWQ6IFwiK3BhdGgpO1xuXHRcdFx0XHRpZiAoZ2VuTWlwbWFwcykgLy93ZSBzdGlsbCBuZWVkIHRvIGdlbiBtaXBtYXBzIG9uIHRoZSAxeDEgZHVtbXlcblx0XHRcdFx0XHRnbC5nZW5lcmF0ZU1pcG1hcChnbC5URVhUVVJFXzJEKTtcblx0XHRcdFx0aWYgKGZhaWxDQilcblx0XHRcdFx0XHRmYWlsQ0IoKTtcblx0XHRcdH1cblxuXHRcdFx0aW1nLnNyYyA9IHBhdGg7XG5cdFx0fSBcblx0XHQvL290aGVyd2lzZSBhc3N1bWUgb3VyIHJlZ3VsYXIgbGlzdCBvZiB3aWR0aC9oZWlnaHQgYXJndW1lbnRzIGFyZSBwYXNzZWRcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMudXBsb2FkRGF0YSh3aWR0aCwgaGVpZ2h0LCBmb3JtYXQsIGRhdGFUeXBlLCBkYXRhLCBnZW5NaXBtYXBzKTtcblx0XHR9XG5cdH0sXHRcblxuXHQvKipcblx0ICogQ2FsbGVkIGluIHRoZSBUZXh0dXJlIGNvbnN0cnVjdG9yLCBhbmQgYWZ0ZXIgdGhlIEdMIGNvbnRleHQgaGFzIGJlZW4gcmUtaW5pdGlhbGl6ZWQuIFxuXHQgKiBTdWJjbGFzc2VzIGNhbiBvdmVycmlkZSB0aGlzIHRvIHByb3ZpZGUgYSBjdXN0b20gZGF0YSB1cGxvYWQsIGUuZy4gY3ViZW1hcHMgb3IgY29tcHJlc3NlZFxuXHQgKiB0ZXh0dXJlcy5cblx0ICpcblx0ICogQG1ldGhvZCAgY3JlYXRlXG5cdCAqL1xuXHRjcmVhdGU6IGZ1bmN0aW9uKCkge1xuXHRcdHRoaXMuZ2wgPSB0aGlzLmNvbnRleHQuZ2w7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLmlkID0gZ2wuY3JlYXRlVGV4dHVyZSgpOyAvL3RleHR1cmUgSUQgaXMgcmVjcmVhdGVkXG5cdFx0dGhpcy53aWR0aCA9IHRoaXMuaGVpZ2h0ID0gMDsgLy9zaXplIGlzIHJlc2V0IHRvIHplcm8gdW50aWwgbG9hZGVkXG5cdFx0dGhpcy50YXJnZXQgPSBnbC5URVhUVVJFXzJEOyAgLy90aGUgcHJvdmlkZXIgY2FuIGNoYW5nZSB0aGlzIGlmIG5lY2Vzc2FyeSAoZS5nLiBjdWJlIG1hcHMpXG5cblx0XHR0aGlzLmJpbmQoKTtcblxuXG5cdFx0Ly9UT0RPOiBjbGVhbiB0aGVzZSB1cCBhIGxpdHRsZS4gXG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX1BSRU1VTFRJUExZX0FMUEhBX1dFQkdMLCBUZXh0dXJlLlVOUEFDS19QUkVNVUxUSVBMWV9BTFBIQSk7XG5cdFx0Z2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0FMSUdOTUVOVCwgVGV4dHVyZS5VTlBBQ0tfQUxJR05NRU5UKTtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCBUZXh0dXJlLlVOUEFDS19GTElQX1kpO1xuXHRcdFxuXHRcdHZhciBjb2xvcnNwYWNlID0gVGV4dHVyZS5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OIHx8IGdsLkJST1dTRVJfREVGQVVMVF9XRUJHTDtcblx0XHRnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfQ09MT1JTUEFDRV9DT05WRVJTSU9OX1dFQkdMLCBjb2xvcnNwYWNlKTtcblxuXHRcdC8vc2V0dXAgd3JhcCBtb2RlcyB3aXRob3V0IGJpbmRpbmcgcmVkdW5kYW50bHlcblx0XHR0aGlzLnNldFdyYXAodGhpcy53cmFwUywgdGhpcy53cmFwVCwgZmFsc2UpO1xuXHRcdHRoaXMuc2V0RmlsdGVyKHRoaXMubWluRmlsdGVyLCB0aGlzLm1hZ0ZpbHRlciwgZmFsc2UpO1xuXHRcdFxuXHRcdGlmICh0aGlzLm1hbmFnZWRBcmdzLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0dGhpcy5zZXR1cC5hcHBseSh0aGlzLCB0aGlzLm1hbmFnZWRBcmdzKTtcblx0XHR9XG5cdH0sXG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoaXMgdGV4dHVyZSBieSBkZWxldGluZyB0aGUgR0wgcmVzb3VyY2UsXG5cdCAqIHJlbW92aW5nIGl0IGZyb20gdGhlIFdlYkdMQ29udGV4dCBtYW5hZ2VtZW50IHN0YWNrLFxuXHQgKiBzZXR0aW5nIGl0cyBzaXplIHRvIHplcm8sIGFuZCBpZCBhbmQgbWFuYWdlZCBhcmd1bWVudHMgdG8gbnVsbC5cblx0ICogXG5cdCAqIFRyeWluZyB0byB1c2UgdGhpcyB0ZXh0dXJlIGFmdGVyIG1heSBsZWFkIHRvIHVuZGVmaW5lZCBiZWhhdmlvdXIuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmlkICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZVRleHR1cmUodGhpcy5pZCk7XG5cdFx0aWYgKHRoaXMuY29udGV4dClcblx0XHRcdHRoaXMuY29udGV4dC5yZW1vdmVNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXHRcdHRoaXMud2lkdGggPSB0aGlzLmhlaWdodCA9IDA7XG5cdFx0dGhpcy5pZCA9IG51bGw7XG5cdFx0dGhpcy5tYW5hZ2VkQXJncyA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gbnVsbDtcblx0XHR0aGlzLmdsID0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogU2V0cyB0aGUgd3JhcCBtb2RlIGZvciB0aGlzIHRleHR1cmU7IGlmIHRoZSBzZWNvbmQgYXJndW1lbnRcblx0ICogaXMgdW5kZWZpbmVkIG9yIGZhbHN5LCB0aGVuIGJvdGggUyBhbmQgVCB3cmFwIHdpbGwgdXNlIHRoZSBmaXJzdFxuXHQgKiBhcmd1bWVudC5cblx0ICpcblx0ICogWW91IGNhbiB1c2UgVGV4dHVyZS5XcmFwIGNvbnN0YW50cyBmb3IgY29udmVuaWVuY2UsIHRvIGF2b2lkIG5lZWRpbmcgXG5cdCAqIGEgR0wgcmVmZXJlbmNlLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRXcmFwXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBzIHRoZSBTIHdyYXAgbW9kZVxuXHQgKiBAcGFyYW0ge0dMZW51bX0gdCB0aGUgVCB3cmFwIG1vZGVcblx0ICogQHBhcmFtIHtCb29sZWFufSBpZ25vcmVCaW5kIChvcHRpb25hbCkgaWYgdHJ1ZSwgdGhlIGJpbmQgd2lsbCBiZSBpZ25vcmVkLiBcblx0ICovXG5cdHNldFdyYXA6IGZ1bmN0aW9uKHMsIHQsIGlnbm9yZUJpbmQpIHsgLy9UT0RPOiBzdXBwb3J0IFIgd3JhcCBtb2RlXG5cdFx0aWYgKHMgJiYgdCkge1xuXHRcdFx0dGhpcy53cmFwUyA9IHM7XG5cdFx0XHR0aGlzLndyYXBUID0gdDtcblx0XHR9IGVsc2UgXG5cdFx0XHR0aGlzLndyYXBTID0gdGhpcy53cmFwVCA9IHM7XG5cdFx0XG5cdFx0Ly9lbmZvcmNlIFBPVCBydWxlcy4uXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcdFxuXG5cdFx0aWYgKCFpZ25vcmVCaW5kKVxuXHRcdFx0dGhpcy5iaW5kKCk7XG5cblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGdsLnRleFBhcmFtZXRlcmkodGhpcy50YXJnZXQsIGdsLlRFWFRVUkVfV1JBUF9TLCB0aGlzLndyYXBTKTtcblx0XHRnbC50ZXhQYXJhbWV0ZXJpKHRoaXMudGFyZ2V0LCBnbC5URVhUVVJFX1dSQVBfVCwgdGhpcy53cmFwVCk7XG5cdH0sXG5cblxuXHQvKipcblx0ICogU2V0cyB0aGUgbWluIGFuZCBtYWcgZmlsdGVyIGZvciB0aGlzIHRleHR1cmU7IFxuXHQgKiBpZiBtYWcgaXMgdW5kZWZpbmVkIG9yIGZhbHN5LCB0aGVuIGJvdGggbWluIGFuZCBtYWcgd2lsbCB1c2UgdGhlXG5cdCAqIGZpbHRlciBzcGVjaWZpZWQgZm9yIG1pbi5cblx0ICpcblx0ICogWW91IGNhbiB1c2UgVGV4dHVyZS5GaWx0ZXIgY29uc3RhbnRzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgbmVlZGluZyBcblx0ICogYSBHTCByZWZlcmVuY2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHNldEZpbHRlclxuXHQgKiBAcGFyYW0ge0dMZW51bX0gbWluIHRoZSBtaW5pZmljYXRpb24gZmlsdGVyXG5cdCAqIEBwYXJhbSB7R0xlbnVtfSBtYWcgdGhlIG1hZ25pZmljYXRpb24gZmlsdGVyXG5cdCAqIEBwYXJhbSB7Qm9vbGVhbn0gaWdub3JlQmluZCBpZiB0cnVlLCB0aGUgYmluZCB3aWxsIGJlIGlnbm9yZWQuIFxuXHQgKi9cblx0c2V0RmlsdGVyOiBmdW5jdGlvbihtaW4sIG1hZywgaWdub3JlQmluZCkgeyBcblx0XHRpZiAobWluICYmIG1hZykge1xuXHRcdFx0dGhpcy5taW5GaWx0ZXIgPSBtaW47XG5cdFx0XHR0aGlzLm1hZ0ZpbHRlciA9IG1hZztcblx0XHR9IGVsc2UgXG5cdFx0XHR0aGlzLm1pbkZpbHRlciA9IHRoaXMubWFnRmlsdGVyID0gbWluO1xuXHRcdFxuXHRcdC8vZW5mb3JjZSBQT1QgcnVsZXMuLlxuXHRcdHRoaXMuX2NoZWNrUE9UKCk7XG5cblx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHR0aGlzLmJpbmQoKTtcblxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCB0aGlzLm1pbkZpbHRlcik7XG5cdFx0Z2wudGV4UGFyYW1ldGVyaSh0aGlzLnRhcmdldCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCB0aGlzLm1hZ0ZpbHRlcik7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEEgbG93LWxldmVsIG1ldGhvZCB0byB1cGxvYWQgdGhlIHNwZWNpZmllZCBBcnJheUJ1ZmZlclZpZXdcblx0ICogdG8gdGhpcyB0ZXh0dXJlLiBUaGlzIHdpbGwgY2F1c2UgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhpc1xuXHQgKiB0ZXh0dXJlIHRvIGNoYW5nZS5cblx0ICpcblx0ICogQG1ldGhvZCAgdXBsb2FkRGF0YVxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICAgICAgICAgIHRoZSBuZXcgd2lkdGggb2YgdGhpcyB0ZXh0dXJlLFxuXHQgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHRzIHRvIHRoZSBsYXN0IHVzZWQgd2lkdGggKG9yIHplcm8pXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0ICAgICAgICAgdGhlIG5ldyBoZWlnaHQgb2YgdGhpcyB0ZXh0dXJlXG5cdCAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdHMgdG8gdGhlIGxhc3QgdXNlZCBoZWlnaHQgKG9yIHplcm8pXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0ICAgICAgICAgdGhlIGRhdGEgZm9ybWF0LCBkZWZhdWx0IFJHQkFcblx0ICogQHBhcmFtICB7R0xlbnVtfSB0eXBlICAgICAgICAgICB0aGUgZGF0YSB0eXBlLCBkZWZhdWx0IFVOU0lHTkVEX0JZVEUgKFVpbnQ4QXJyYXkpXG5cdCAqIEBwYXJhbSAge0FycmF5QnVmZmVyVmlld30gZGF0YSAgdGhlIHJhdyBkYXRhIGZvciB0aGlzIHRleHR1cmUsIG9yIG51bGwgZm9yIGFuIGVtcHR5IGltYWdlXG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGdlbk1pcG1hcHNcdCAgIHdoZXRoZXIgdG8gZ2VuZXJhdGUgbWlwbWFwcyBhZnRlciB1cGxvYWRpbmcgdGhlIGRhdGEsIGRlZmF1bHQgZmFsc2Vcblx0ICovXG5cdHVwbG9hZERhdGE6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQsIGZvcm1hdCwgdHlwZSwgZGF0YSwgZ2VuTWlwbWFwcykge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHRmb3JtYXQgPSBmb3JtYXQgfHwgZ2wuUkdCQTtcblx0XHR0eXBlID0gdHlwZSB8fCBnbC5VTlNJR05FRF9CWVRFO1xuXHRcdGRhdGEgPSBkYXRhIHx8IG51bGw7IC8vbWFrZSBzdXJlIGZhbHNleSB2YWx1ZSBpcyBudWxsIGZvciB0ZXhJbWFnZTJEXG5cblx0XHR0aGlzLndpZHRoID0gKHdpZHRoIHx8IHdpZHRoPT0wKSA/IHdpZHRoIDogdGhpcy53aWR0aDtcblx0XHR0aGlzLmhlaWdodCA9IChoZWlnaHQgfHwgaGVpZ2h0PT0wKSA/IGhlaWdodCA6IHRoaXMuaGVpZ2h0O1xuXG5cdFx0dGhpcy5fY2hlY2tQT1QoKTtcblxuXHRcdHRoaXMuYmluZCgpO1xuXG5cdFx0Z2wudGV4SW1hZ2UyRCh0aGlzLnRhcmdldCwgMCwgZm9ybWF0LCBcblx0XHRcdFx0XHQgIHRoaXMud2lkdGgsIHRoaXMuaGVpZ2h0LCAwLCBmb3JtYXQsXG5cdFx0XHRcdFx0ICB0eXBlLCBkYXRhKTtcblxuXHRcdGlmIChnZW5NaXBtYXBzKVxuXHRcdFx0Z2wuZ2VuZXJhdGVNaXBtYXAodGhpcy50YXJnZXQpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBVcGxvYWRzIEltYWdlRGF0YSwgSFRNTEltYWdlRWxlbWVudCwgSFRNTENhbnZhc0VsZW1lbnQgb3IgXG5cdCAqIEhUTUxWaWRlb0VsZW1lbnQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIHVwbG9hZEltYWdlXG5cdCAqIEBwYXJhbSAge09iamVjdH0gZG9tT2JqZWN0IHRoZSBET00gaW1hZ2UgY29udGFpbmVyXG5cdCAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0IHRoZSBmb3JtYXQsIGRlZmF1bHQgZ2wuUkdCQVxuXHQgKiBAcGFyYW0gIHtHTGVudW19IHR5cGUgdGhlIGRhdGEgdHlwZSwgZGVmYXVsdCBnbC5VTlNJR05FRF9CWVRFXG5cdCAqIEBwYXJhbSAge0Jvb2xlYW59IGdlbk1pcG1hcHMgd2hldGhlciB0byBnZW5lcmF0ZSBtaXBtYXBzIGFmdGVyIHVwbG9hZGluZyB0aGUgZGF0YSwgZGVmYXVsdCBmYWxzZVxuXHQgKi9cblx0dXBsb2FkSW1hZ2U6IGZ1bmN0aW9uKGRvbU9iamVjdCwgZm9ybWF0LCB0eXBlLCBnZW5NaXBtYXBzKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGZvcm1hdCA9IGZvcm1hdCB8fCBnbC5SR0JBO1xuXHRcdHR5cGUgPSB0eXBlIHx8IGdsLlVOU0lHTkVEX0JZVEU7XG5cdFx0XG5cdFx0dGhpcy53aWR0aCA9IGRvbU9iamVjdC53aWR0aDtcblx0XHR0aGlzLmhlaWdodCA9IGRvbU9iamVjdC5oZWlnaHQ7XG5cblx0XHR0aGlzLl9jaGVja1BPVCgpO1xuXG5cdFx0dGhpcy5iaW5kKCk7XG5cblx0XHRnbC50ZXhJbWFnZTJEKHRoaXMudGFyZ2V0LCAwLCBmb3JtYXQsIGZvcm1hdCxcblx0XHRcdFx0XHQgIHR5cGUsIGRvbU9iamVjdCk7XG5cblx0XHRpZiAoZ2VuTWlwbWFwcylcblx0XHRcdGdsLmdlbmVyYXRlTWlwbWFwKHRoaXMudGFyZ2V0KTtcblx0fSxcblxuXHQvKipcblx0ICogSWYgRk9SQ0VfUE9UIGlzIGZhbHNlLCB3ZSB2ZXJpZnkgdGhpcyB0ZXh0dXJlIHRvIHNlZSBpZiBpdCBpcyB2YWxpZCwgXG5cdCAqIGFzIHBlciBub24tcG93ZXItb2YtdHdvIHJ1bGVzLiBJZiBpdCBpcyBub24tcG93ZXItb2YtdHdvLCBpdCBtdXN0IGhhdmUgXG5cdCAqIGEgd3JhcCBtb2RlIG9mIENMQU1QX1RPX0VER0UsIGFuZCB0aGUgbWluaWZpY2F0aW9uIGZpbHRlciBtdXN0IGJlIExJTkVBUlxuXHQgKiBvciBORUFSRVNULiBJZiB3ZSBkb24ndCBzYXRpc2Z5IHRoZXNlIG5lZWRzLCBhbiBlcnJvciBpcyB0aHJvd24uXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBfY2hlY2tQT1Rcblx0ICogQHByaXZhdGVcblx0ICogQHJldHVybiB7W3R5cGVdfSBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRfY2hlY2tQT1Q6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICghVGV4dHVyZS5GT1JDRV9QT1QpIHtcblx0XHRcdC8vSWYgbWluRmlsdGVyIGlzIGFueXRoaW5nIGJ1dCBMSU5FQVIgb3IgTkVBUkVTVFxuXHRcdFx0Ly9vciBpZiB3cmFwUyBvciB3cmFwVCBhcmUgbm90IENMQU1QX1RPX0VER0UuLi5cblx0XHRcdHZhciB3cm9uZ0ZpbHRlciA9ICh0aGlzLm1pbkZpbHRlciAhPT0gVGV4dHVyZS5GaWx0ZXIuTElORUFSICYmIHRoaXMubWluRmlsdGVyICE9PSBUZXh0dXJlLkZpbHRlci5ORUFSRVNUKTtcblx0XHRcdHZhciB3cm9uZ1dyYXAgPSAodGhpcy53cmFwUyAhPT0gVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0UgfHwgdGhpcy53cmFwVCAhPT0gVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0UpO1xuXG5cdFx0XHRpZiAoIHdyb25nRmlsdGVyIHx8IHdyb25nV3JhcCApIHtcblx0XHRcdFx0aWYgKCFpc1Bvd2VyT2ZUd28odGhpcy53aWR0aCkgfHwgIWlzUG93ZXJPZlR3byh0aGlzLmhlaWdodCkpXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKHdyb25nRmlsdGVyIFxuXHRcdFx0XHRcdFx0XHQ/IFwiTm9uLXBvd2VyLW9mLXR3byB0ZXh0dXJlcyBjYW5ub3QgdXNlIG1pcG1hcHBpbmcgYXMgZmlsdGVyXCJcblx0XHRcdFx0XHRcdFx0OiBcIk5vbi1wb3dlci1vZi10d28gdGV4dHVyZXMgbXVzdCB1c2UgQ0xBTVBfVE9fRURHRSBhcyB3cmFwXCIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQmluZHMgdGhlIHRleHR1cmUuIElmIHVuaXQgaXMgc3BlY2lmaWVkLFxuXHQgKiBpdCB3aWxsIGJpbmQgdGhlIHRleHR1cmUgYXQgdGhlIGdpdmVuIHNsb3Rcblx0ICogKFRFWFRVUkUwLCBURVhUVVJFMSwgZXRjKS4gSWYgdW5pdCBpcyBub3Qgc3BlY2lmaWVkLFxuXHQgKiBpdCB3aWxsIHNpbXBseSBiaW5kIHRoZSB0ZXh0dXJlIGF0IHdoaWNoZXZlciBzbG90XG5cdCAqIGlzIGN1cnJlbnRseSBhY3RpdmUuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGJpbmRcblx0ICogQHBhcmFtICB7TnVtYmVyfSB1bml0IHRoZSB0ZXh0dXJlIHVuaXQgaW5kZXgsIHN0YXJ0aW5nIGF0IDBcblx0ICovXG5cdGJpbmQ6IGZ1bmN0aW9uKHVuaXQpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdGlmICh1bml0IHx8IHVuaXQgPT09IDApXG5cdFx0XHRnbC5hY3RpdmVUZXh0dXJlKGdsLlRFWFRVUkUwICsgdW5pdCk7XG5cdFx0Z2wuYmluZFRleHR1cmUodGhpcy50YXJnZXQsIHRoaXMuaWQpO1xuXHR9LFxuXG5cdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5pZCArIFwiOlwiICsgdGhpcy53aWR0aCArIFwieFwiICsgdGhpcy5oZWlnaHQgKyBcIlwiO1xuXHR9XG59KTtcblxuLyoqIFxuICogQSBzZXQgb2YgRmlsdGVyIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5GaWx0ZXIuTkVBUkVTVFxuICogICAgIFRleHR1cmUuRmlsdGVyLk5FQVJFU1RfTUlQTUFQX0xJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLk5FQVJFU1RfTUlQTUFQX05FQVJFU1RcbiAqICAgICBUZXh0dXJlLkZpbHRlci5MSU5FQVJcbiAqICAgICBUZXh0dXJlLkZpbHRlci5MSU5FQVJfTUlQTUFQX0xJTkVBUlxuICogICAgIFRleHR1cmUuRmlsdGVyLkxJTkVBUl9NSVBNQVBfTkVBUkVTVFxuICogYGBgXG4gKiBAYXR0cmlidXRlIEZpbHRlclxuICogQHN0YXRpY1xuICogQHR5cGUge09iamVjdH1cbiAqL1xuVGV4dHVyZS5GaWx0ZXIgPSB7XG5cdE5FQVJFU1Q6IDk3MjgsXG5cdE5FQVJFU1RfTUlQTUFQX0xJTkVBUjogOTk4Nixcblx0TkVBUkVTVF9NSVBNQVBfTkVBUkVTVDogOTk4NCxcblx0TElORUFSOiA5NzI5LFxuXHRMSU5FQVJfTUlQTUFQX0xJTkVBUjogOTk4Nyxcblx0TElORUFSX01JUE1BUF9ORUFSRVNUOiA5OTg1XG59O1xuXG4vKiogXG4gKiBBIHNldCBvZiBXcmFwIGNvbnN0YW50cyB0aGF0IG1hdGNoIHRoZWlyIEdMIGNvdW50ZXJwYXJ0cy5cbiAqIFRoaXMgaXMgZm9yIGNvbnZlbmllbmNlLCB0byBhdm9pZCB0aGUgbmVlZCBmb3IgYSBHTCByZW5kZXJpbmcgY29udGV4dC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgXG4gKiAgICAgVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0VcbiAqICAgICBUZXh0dXJlLldyYXAuTUlSUk9SRURfUkVQRUFUXG4gKiAgICAgVGV4dHVyZS5XcmFwLlJFUEVBVFxuICogYGBgXG4gKiBAYXR0cmlidXRlIFdyYXBcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuV3JhcCA9IHtcblx0Q0xBTVBfVE9fRURHRTogMzMwNzEsXG5cdE1JUlJPUkVEX1JFUEVBVDogMzM2NDgsXG5cdFJFUEVBVDogMTA0OTdcbn07XG5cbi8qKiBcbiAqIEEgc2V0IG9mIEZvcm1hdCBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuRm9ybWF0LlJHQlxuICogICAgIFRleHR1cmUuRm9ybWF0LlJHQkFcbiAqICAgICBUZXh0dXJlLkZvcm1hdC5MVU1JTkFOQ0VfQUxQSEFcbiAqIGBgYFxuICogQGF0dHJpYnV0ZSBGb3JtYXRcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtPYmplY3R9XG4gKi9cblRleHR1cmUuRm9ybWF0ID0ge1xuXHRERVBUSF9DT01QT05FTlQ6IDY0MDIsXG5cdEFMUEhBOiA2NDA2LFxuXHRSR0JBOiA2NDA4LFxuXHRSR0I6IDY0MDcsXG5cdExVTUlOQU5DRTogNjQwOSxcblx0TFVNSU5BTkNFX0FMUEhBOiA2NDEwXG59O1xuXG4vKiogXG4gKiBBIHNldCBvZiBEYXRhVHlwZSBjb25zdGFudHMgdGhhdCBtYXRjaCB0aGVpciBHTCBjb3VudGVycGFydHMuXG4gKiBUaGlzIGlzIGZvciBjb252ZW5pZW5jZSwgdG8gYXZvaWQgdGhlIG5lZWQgZm9yIGEgR0wgcmVuZGVyaW5nIGNvbnRleHQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogICAgIFRleHR1cmUuRGF0YVR5cGUuVU5TSUdORURfQllURSBcbiAqICAgICBUZXh0dXJlLkRhdGFUeXBlLkZMT0FUIFxuICogYGBgXG4gKiBAYXR0cmlidXRlIERhdGFUeXBlXG4gKiBAc3RhdGljXG4gKiBAdHlwZSB7T2JqZWN0fVxuICovXG5UZXh0dXJlLkRhdGFUeXBlID0ge1xuXHRCWVRFOiA1MTIwLFxuXHRTSE9SVDogNTEyMixcblx0SU5UOiA1MTI0LFxuXHRGTE9BVDogNTEyNixcblx0VU5TSUdORURfQllURTogNTEyMSxcblx0VU5TSUdORURfSU5UOiA1MTI1LFxuXHRVTlNJR05FRF9TSE9SVDogNTEyMyxcblx0VU5TSUdORURfU0hPUlRfNF80XzRfNDogMzI4MTksXG5cdFVOU0lHTkVEX1NIT1JUXzVfNV81XzE6IDMyODIwLFxuXHRVTlNJR05FRF9TSE9SVF81XzZfNTogMzM2MzVcbn1cblxuLyoqXG4gKiBUaGUgZGVmYXVsdCB3cmFwIG1vZGUgd2hlbiBjcmVhdGluZyBuZXcgdGV4dHVyZXMuIElmIGEgY3VzdG9tIFxuICogcHJvdmlkZXIgd2FzIHNwZWNpZmllZCwgaXQgbWF5IGNob29zZSB0byBvdmVycmlkZSB0aGlzIGRlZmF1bHQgbW9kZS5cbiAqIFxuICogQGF0dHJpYnV0ZSB7R0xlbnVtfSBERUZBVUxUX1dSQVBcbiAqIEBzdGF0aWMgXG4gKiBAZGVmYXVsdCAgVGV4dHVyZS5XcmFwLkNMQU1QX1RPX0VER0VcbiAqL1xuVGV4dHVyZS5ERUZBVUxUX1dSQVAgPSBUZXh0dXJlLldyYXAuQ0xBTVBfVE9fRURHRTtcblxuXG4vKipcbiAqIFRoZSBkZWZhdWx0IGZpbHRlciBtb2RlIHdoZW4gY3JlYXRpbmcgbmV3IHRleHR1cmVzLiBJZiBhIGN1c3RvbVxuICogcHJvdmlkZXIgd2FzIHNwZWNpZmllZCwgaXQgbWF5IGNob29zZSB0byBvdmVycmlkZSB0aGlzIGRlZmF1bHQgbW9kZS5cbiAqXG4gKiBAYXR0cmlidXRlIHtHTGVudW19IERFRkFVTFRfRklMVEVSXG4gKiBAc3RhdGljXG4gKiBAZGVmYXVsdCAgVGV4dHVyZS5GaWx0ZXIuTElORUFSXG4gKi9cblRleHR1cmUuREVGQVVMVF9GSUxURVIgPSBUZXh0dXJlLkZpbHRlci5ORUFSRVNUO1xuXG4vKipcbiAqIEJ5IGRlZmF1bHQsIHdlIGRvIHNvbWUgZXJyb3IgY2hlY2tpbmcgd2hlbiBjcmVhdGluZyB0ZXh0dXJlc1xuICogdG8gZW5zdXJlIHRoYXQgdGhleSB3aWxsIGJlIFwicmVuZGVyYWJsZVwiIGJ5IFdlYkdMLiBOb24tcG93ZXItb2YtdHdvXG4gKiB0ZXh0dXJlcyBtdXN0IHVzZSBDTEFNUF9UT19FREdFIGFzIHRoZWlyIHdyYXAgbW9kZSwgYW5kIE5FQVJFU1Qgb3IgTElORUFSXG4gKiBhcyB0aGVpciB3cmFwIG1vZGUuIEZ1cnRoZXIsIHRyeWluZyB0byBnZW5lcmF0ZSBtaXBtYXBzIGZvciBhIE5QT1QgaW1hZ2VcbiAqIHdpbGwgbGVhZCB0byBlcnJvcnMuIFxuICpcbiAqIEhvd2V2ZXIsIHlvdSBjYW4gZGlzYWJsZSB0aGlzIGVycm9yIGNoZWNraW5nIGJ5IHNldHRpbmcgYEZPUkNFX1BPVGAgdG8gdHJ1ZS5cbiAqIFRoaXMgbWF5IGJlIHVzZWZ1bCBpZiB5b3UgYXJlIHJ1bm5pbmcgb24gc3BlY2lmaWMgaGFyZHdhcmUgdGhhdCBzdXBwb3J0cyBQT1QgXG4gKiB0ZXh0dXJlcywgb3IgaW4gc29tZSBmdXR1cmUgY2FzZSB3aGVyZSBOUE9UIHRleHR1cmVzIGlzIGFkZGVkIGFzIGEgV2ViR0wgZXh0ZW5zaW9uLlxuICogXG4gKiBAYXR0cmlidXRlIHtCb29sZWFufSBGT1JDRV9QT1RcbiAqIEBzdGF0aWNcbiAqIEBkZWZhdWx0ICBmYWxzZVxuICovXG5UZXh0dXJlLkZPUkNFX1BPVCA9IGZhbHNlO1xuXG4vL2RlZmF1bHQgcGl4ZWwgc3RvcmUgb3BlcmF0aW9ucy4gVXNlZCBpbiBjcmVhdGUoKVxuVGV4dHVyZS5VTlBBQ0tfRkxJUF9ZID0gZmFsc2U7XG5UZXh0dXJlLlVOUEFDS19BTElHTk1FTlQgPSAxO1xuVGV4dHVyZS5VTlBBQ0tfUFJFTVVMVElQTFlfQUxQSEEgPSB0cnVlOyBcblRleHR1cmUuVU5QQUNLX0NPTE9SU1BBQ0VfQ09OVkVSU0lPTiA9IHVuZGVmaW5lZDtcblxuLy9mb3IgdGhlIEltYWdlIGNvbnN0cnVjdG9yIHdlIG5lZWQgdG8gaGFuZGxlIHRoaW5ncyBhIGJpdCBkaWZmZXJlbnRseS4uXG5UZXh0dXJlLlVTRV9EVU1NWV8xeDFfREFUQSA9IHRydWU7XG5cbi8qKlxuICogVXRpbGl0eSB0byBnZXQgdGhlIG51bWJlciBvZiBjb21wb25lbnRzIGZvciB0aGUgZ2l2ZW4gR0xlbnVtLCBlLmcuIGdsLlJHQkEgcmV0dXJucyA0LlxuICogUmV0dXJucyBudWxsIGlmIHRoZSBzcGVjaWZpZWQgZm9ybWF0IGlzIG5vdCBvZiB0eXBlIERFUFRIX0NPTVBPTkVOVCwgQUxQSEEsIExVTUlOQU5DRSxcbiAqIExVTUlOQU5DRV9BTFBIQSwgUkdCLCBvciBSR0JBLlxuICogXG4gKiBAbWV0aG9kIGdldE51bUNvbXBvbmVudHNcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSAge0dMZW51bX0gZm9ybWF0IGEgdGV4dHVyZSBmb3JtYXQsIGkuZS4gVGV4dHVyZS5Gb3JtYXQuUkdCQVxuICogQHJldHVybiB7TnVtYmVyfSB0aGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgZm9yIHRoaXMgZm9ybWF0XG4gKi9cblRleHR1cmUuZ2V0TnVtQ29tcG9uZW50cyA9IGZ1bmN0aW9uKGZvcm1hdCkge1xuXHRzd2l0Y2ggKGZvcm1hdCkge1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuREVQVEhfQ09NUE9ORU5UOlxuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuQUxQSEE6XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5MVU1JTkFOQ0U6XG5cdFx0XHRyZXR1cm4gMTtcblx0XHRjYXNlIFRleHR1cmUuRm9ybWF0LkxVTUlOQU5DRV9BTFBIQTpcblx0XHRcdHJldHVybiAyO1xuXHRcdGNhc2UgVGV4dHVyZS5Gb3JtYXQuUkdCOlxuXHRcdFx0cmV0dXJuIDM7XG5cdFx0Y2FzZSBUZXh0dXJlLkZvcm1hdC5SR0JBOlxuXHRcdFx0cmV0dXJuIDQ7XG5cdH1cblx0cmV0dXJuIG51bGw7XG59O1xuXG4vL1VubWFuYWdlZCB0ZXh0dXJlczpcbi8vXHRIVE1MIGVsZW1lbnRzIGxpa2UgSW1hZ2UsIFZpZGVvLCBDYW52YXNcbi8vXHRwaXhlbHMgYnVmZmVyIGZyb20gQ2FudmFzXG4vL1x0cGl4ZWxzIGFycmF5XG5cbi8vTmVlZCBzcGVjaWFsIGhhbmRsaW5nOlxuLy8gIGNvbnRleHQub25Db250ZXh0TG9zdC5hZGQoZnVuY3Rpb24oKSB7XG4vLyAgXHRjcmVhdGVEeW5hbWljVGV4dHVyZSgpO1xuLy8gIH0uYmluZCh0aGlzKSk7XG5cbi8vTWFuYWdlZCB0ZXh0dXJlczpcbi8vXHRpbWFnZXMgc3BlY2lmaWVkIHdpdGggYSBwYXRoXG4vL1x0dGhpcyB3aWxsIHVzZSBJbWFnZSB1bmRlciB0aGUgaG9vZFxuXG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZTsiLCJ2YXIgQ2xhc3MgPSByZXF1aXJlKCdrbGFzc2UnKTtcbnZhciBUZXh0dXJlID0gcmVxdWlyZSgnLi9UZXh0dXJlJyk7XG5cbi8vVGhpcyBpcyBhIEdMLXNwZWNpZmljIHRleHR1cmUgcmVnaW9uLCBlbXBsb3lpbmcgdGFuZ2VudCBzcGFjZSBub3JtYWxpemVkIGNvb3JkaW5hdGVzIFUgYW5kIFYuXG4vL0EgY2FudmFzLXNwZWNpZmljIHJlZ2lvbiB3b3VsZCByZWFsbHkganVzdCBiZSBhIGxpZ2h0d2VpZ2h0IG9iamVjdCB3aXRoIHsgeCwgeSwgd2lkdGgsIGhlaWdodCB9XG4vL2luIHBpeGVscy5cbnZhciBUZXh0dXJlUmVnaW9uID0gbmV3IENsYXNzKHtcblxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBUZXh0dXJlUmVnaW9uKHRleHR1cmUsIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLnRleHR1cmUgPSB0ZXh0dXJlO1xuXHRcdHRoaXMuc2V0UmVnaW9uKHgsIHksIHdpZHRoLCBoZWlnaHQpO1xuXHR9LFxuXG5cdHNldFVWczogZnVuY3Rpb24odSwgdiwgdTIsIHYyKSB7XG5cdFx0dGhpcy5yZWdpb25XaWR0aCA9IE1hdGgucm91bmQoTWF0aC5hYnModTIgLSB1KSAqIHRoaXMudGV4dHVyZS53aWR0aCk7XG4gICAgICAgIHRoaXMucmVnaW9uSGVpZ2h0ID0gTWF0aC5yb3VuZChNYXRoLmFicyh2MiAtIHYpICogdGhpcy50ZXh0dXJlLmhlaWdodCk7XG5cbiAgICAgICAgLy8gRnJvbSBMaWJHRFggVGV4dHVyZVJlZ2lvbi5qYXZhIC0tIFxuXHRcdC8vIEZvciBhIDF4MSByZWdpb24sIGFkanVzdCBVVnMgdG93YXJkIHBpeGVsIGNlbnRlciB0byBhdm9pZCBmaWx0ZXJpbmcgYXJ0aWZhY3RzIG9uIEFNRCBHUFVzIHdoZW4gZHJhd2luZyB2ZXJ5IHN0cmV0Y2hlZC5cblx0XHRpZiAodGhpcy5yZWdpb25XaWR0aCA9PSAxICYmIHRoaXMucmVnaW9uSGVpZ2h0ID09IDEpIHtcblx0XHRcdHZhciBhZGp1c3RYID0gMC4yNSAvIHRoaXMudGV4dHVyZS53aWR0aDtcblx0XHRcdHUgKz0gYWRqdXN0WDtcblx0XHRcdHUyIC09IGFkanVzdFg7XG5cdFx0XHR2YXIgYWRqdXN0WSA9IDAuMjUgLyB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdFx0diArPSBhZGp1c3RZO1xuXHRcdFx0djIgLT0gYWRqdXN0WTtcblx0XHR9XG5cblx0XHR0aGlzLnUgPSB1O1xuXHRcdHRoaXMudiA9IHY7XG5cdFx0dGhpcy51MiA9IHUyO1xuXHRcdHRoaXMudjIgPSB2Mjtcblx0fSxcblxuXHRzZXRSZWdpb246IGZ1bmN0aW9uKHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR4ID0geCB8fCAwO1xuXHRcdHkgPSB5IHx8IDA7XG5cdFx0d2lkdGggPSAod2lkdGg9PT0wIHx8IHdpZHRoKSA/IHdpZHRoIDogdGhpcy50ZXh0dXJlLndpZHRoO1xuXHRcdGhlaWdodCA9IChoZWlnaHQ9PT0wIHx8IGhlaWdodCkgPyBoZWlnaHQgOiB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXG5cdFx0dmFyIGludlRleFdpZHRoID0gMSAvIHRoaXMudGV4dHVyZS53aWR0aDtcblx0XHR2YXIgaW52VGV4SGVpZ2h0ID0gMSAvIHRoaXMudGV4dHVyZS5oZWlnaHQ7XG5cdFx0dGhpcy5zZXRVVnMoeCAqIGludlRleFdpZHRoLCB5ICogaW52VGV4SGVpZ2h0LCAoeCArIHdpZHRoKSAqIGludlRleFdpZHRoLCAoeSArIGhlaWdodCkgKiBpbnZUZXhIZWlnaHQpO1xuXHRcdHRoaXMucmVnaW9uV2lkdGggPSBNYXRoLmFicyh3aWR0aCk7XG5cdFx0dGhpcy5yZWdpb25IZWlnaHQgPSBNYXRoLmFicyhoZWlnaHQpO1xuXHR9LFxuXG5cdC8qKiBTZXRzIHRoZSB0ZXh0dXJlIHRvIHRoYXQgb2YgdGhlIHNwZWNpZmllZCByZWdpb24gYW5kIHNldHMgdGhlIGNvb3JkaW5hdGVzIHJlbGF0aXZlIHRvIHRoZSBzcGVjaWZpZWQgcmVnaW9uLiAqL1xuXHRzZXRGcm9tUmVnaW9uOiBmdW5jdGlvbihyZWdpb24sIHgsIHksIHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLnRleHR1cmUgPSByZWdpb24udGV4dHVyZTtcblx0XHR0aGlzLnNldChyZWdpb24uZ2V0UmVnaW9uWCgpICsgeCwgcmVnaW9uLmdldFJlZ2lvblkoKSArIHksIHdpZHRoLCBoZWlnaHQpO1xuXHR9LFxuXG5cblx0Ly9UT0RPOiBhZGQgc2V0dGVycyBmb3IgcmVnaW9uWC9ZIGFuZCByZWdpb25XaWR0aC9IZWlnaHRcblxuXHRyZWdpb25YOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMudSAqIHRoaXMudGV4dHVyZS53aWR0aCk7XG5cdFx0fSBcblx0fSxcblxuXHRyZWdpb25ZOiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMudiAqIHRoaXMudGV4dHVyZS5oZWlnaHQpO1xuXHRcdH1cblx0fSxcblxuXHRmbGlwOiBmdW5jdGlvbih4LCB5KSB7XG5cdFx0dmFyIHRlbXA7XG5cdFx0aWYgKHgpIHtcblx0XHRcdHRlbXAgPSB0aGlzLnU7XG5cdFx0XHR0aGlzLnUgPSB0aGlzLnUyO1xuXHRcdFx0dGhpcy51MiA9IHRlbXA7XG5cdFx0fVxuXHRcdGlmICh5KSB7XG5cdFx0XHR0ZW1wID0gdGhpcy52O1xuXHRcdFx0dGhpcy52ID0gdGhpcy52Mjtcblx0XHRcdHRoaXMudjIgPSB0ZW1wO1xuXHRcdH1cblx0fVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dHVyZVJlZ2lvbjsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xudmFyIFNpZ25hbCA9IHJlcXVpcmUoJ3NpZ25hbHMnKTtcblxuLyoqXG4gKiBBIHRoaW4gd3JhcHBlciBhcm91bmQgV2ViR0xSZW5kZXJpbmdDb250ZXh0IHdoaWNoIGhhbmRsZXNcbiAqIGNvbnRleHQgbG9zcyBhbmQgcmVzdG9yZSB3aXRoIHZhcmlvdXMgcmVuZGVyaW5nIG9iamVjdHMgKHRleHR1cmVzLFxuICogc2hhZGVycyBhbmQgYnVmZmVycykuIFRoaXMgYWxzbyBoYW5kbGVzIGdlbmVyYWwgdmlld3BvcnQgbWFuYWdlbWVudC5cbiAqXG4gKiBJZiB0aGUgdmlldyBpcyBub3Qgc3BlY2lmaWVkLCBhIGNhbnZhcyB3aWxsIGJlIGNyZWF0ZWQuXG4gKiBcbiAqIEBjbGFzcyAgV2ViR0xDb250ZXh0XG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7TnVtYmVyfSB3aWR0aCB0aGUgd2lkdGggb2YgdGhlIEdMIGNhbnZhc1xuICogQHBhcmFtIHtOdW1iZXJ9IGhlaWdodCB0aGUgaGVpZ2h0IG9mIHRoZSBHTCBjYW52YXNcbiAqIEBwYXJhbSB7SFRNTENhbnZhc0VsZW1lbnR9IHZpZXcgdGhlIG9wdGlvbmFsIERPTSBjYW52YXMgZWxlbWVudFxuICogQHBhcmFtIHtPYmplY3R9IGNvbnRleHRBdHRyaWJ1ZXRzIGFuIG9iamVjdCBjb250YWluaW5nIGNvbnRleHQgYXR0cmlicyB3aGljaFxuICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgYmUgdXNlZCBkdXJpbmcgR0wgaW5pdGlhbGl6YXRpb25cbiAqL1xudmFyIFdlYkdMQ29udGV4dCA9IG5ldyBDbGFzcyh7XG5cdFxuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBXZWJHTENvbnRleHQod2lkdGgsIGhlaWdodCwgdmlldywgY29udGV4dEF0dHJpYnV0ZXMpIHtcblx0XHQvKipcblx0XHQgKiBUaGUgbGlzdCBvZiByZW5kZXJpbmcgb2JqZWN0cyAoc2hhZGVycywgVkJPcywgdGV4dHVyZXMsIGV0Yykgd2hpY2ggYXJlIFxuXHRcdCAqIGN1cnJlbnRseSBiZWluZyBtYW5hZ2VkLiBBbnkgb2JqZWN0IHdpdGggYSBcImNyZWF0ZVwiIG1ldGhvZCBjYW4gYmUgYWRkZWRcblx0XHQgKiB0byB0aGlzIGxpc3QuIFVwb24gZGVzdHJveWluZyB0aGUgcmVuZGVyaW5nIG9iamVjdCwgaXQgc2hvdWxkIGJlIHJlbW92ZWQuXG5cdFx0ICogU2VlIGFkZE1hbmFnZWRPYmplY3QgYW5kIHJlbW92ZU1hbmFnZWRPYmplY3QuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtBcnJheX0gbWFuYWdlZE9iamVjdHNcblx0XHQgKi9cblx0XHR0aGlzLm1hbmFnZWRPYmplY3RzID0gW107XG5cblx0XHQvKipcblx0XHQgKiBUaGUgYWN0dWFsIEdMIGNvbnRleHQuIFlvdSBjYW4gdXNlIHRoaXMgZm9yXG5cdFx0ICogcmF3IEdMIGNhbGxzIG9yIHRvIGFjY2VzcyBHTGVudW0gY29uc3RhbnRzLiBUaGlzXG5cdFx0ICogd2lsbCBiZSB1cGRhdGVkIG9uIGNvbnRleHQgcmVzdG9yZS4gV2hpbGUgdGhlIFdlYkdMQ29udGV4dFxuXHRcdCAqIGlzIG5vdCBgdmFsaWRgLCB5b3Ugc2hvdWxkIG5vdCB0cnkgdG8gYWNjZXNzIEdMIHN0YXRlLlxuXHRcdCAqIFxuXHRcdCAqIEBwcm9wZXJ0eSBnbFxuXHRcdCAqIEB0eXBlIHtXZWJHTFJlbmRlcmluZ0NvbnRleHR9XG5cdFx0ICovXG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgY2FudmFzIERPTSBlbGVtZW50IGZvciB0aGlzIGNvbnRleHQuXG5cdFx0ICogQHByb3BlcnR5IHtOdW1iZXJ9IHZpZXdcblx0XHQgKi9cblx0XHR0aGlzLnZpZXcgPSB2aWV3IHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJjYW52YXNcIik7XG5cblx0XHQvL2RlZmF1bHQgc2l6ZSBhcyBwZXIgc3BlYzpcblx0XHQvL2h0dHA6Ly93d3cudzMub3JnL1RSLzIwMTIvV0QtaHRtbDUtYXV0aG9yLTIwMTIwMzI5L3RoZS1jYW52YXMtZWxlbWVudC5odG1sI3RoZS1jYW52YXMtZWxlbWVudFxuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFRoZSB3aWR0aCBvZiB0aGlzIGNhbnZhcy5cblx0XHQgKlxuXHRcdCAqIEBwcm9wZXJ0eSB3aWR0aFxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdFx0ICovXG5cdFx0dGhpcy53aWR0aCA9IHRoaXMudmlldy53aWR0aCA9IHdpZHRoIHx8IDMwMDtcblxuXHRcdC8qKlxuXHRcdCAqIFRoZSBoZWlnaHQgb2YgdGhpcyBjYW52YXMuXG5cdFx0ICogQHByb3BlcnR5IGhlaWdodFxuXHRcdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdFx0ICovXG5cdFx0dGhpcy5oZWlnaHQgPSB0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0IHx8IDE1MDtcblxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIGNvbnRleHQgYXR0cmlidXRlcyBmb3IgaW5pdGlhbGl6aW5nIHRoZSBHTCBzdGF0ZS4gVGhpcyBtaWdodCBpbmNsdWRlXG5cdFx0ICogYW50aS1hbGlhc2luZywgYWxwaGEgc2V0dGluZ3MsIHZlcmlzb24sIGFuZCBzbyBmb3J0aC5cblx0XHQgKiBcblx0XHQgKiBAcHJvcGVydHkge09iamVjdH0gY29udGV4dEF0dHJpYnV0ZXMgXG5cdFx0ICovXG5cdFx0dGhpcy5jb250ZXh0QXR0cmlidXRlcyA9IGNvbnRleHRBdHRyaWJ1dGVzO1xuXHRcdFxuXHRcdC8qKlxuXHRcdCAqIFdoZXRoZXIgdGhpcyBjb250ZXh0IGlzICd2YWxpZCcsIGkuZS4gcmVuZGVyYWJsZS4gQSBjb250ZXh0IHRoYXQgaGFzIGJlZW4gbG9zdFxuXHRcdCAqIChhbmQgbm90IHlldCByZXN0b3JlZCkgb3IgZGVzdHJveWVkIGlzIGludmFsaWQuXG5cdFx0ICogXG5cdFx0ICogQHByb3BlcnR5IHtCb29sZWFufSB2YWxpZFxuXHRcdCAqL1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdC8qKlxuXHRcdCAqIEEgc2lnbmFsIGRpc3BhdGNoZWQgd2hlbiBHTCBjb250ZXh0IGlzIGxvc3QuIFxuXHRcdCAqIFxuXHRcdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIGlzIHRoZSBXZWJHTENvbnRleHRcblx0XHQgKiBtYW5hZ2luZyB0aGUgY29udGV4dCBsb3NzLlxuXHRcdCAqIFxuXHRcdCAqIEBldmVudCB7U2lnbmFsfSBsb3N0XG5cdFx0ICovXG5cdFx0dGhpcy5sb3N0ID0gbmV3IFNpZ25hbCgpO1xuXG5cdFx0LyoqXG5cdFx0ICogQSBzaWduYWwgZGlzcGF0Y2hlZCB3aGVuIEdMIGNvbnRleHQgaXMgcmVzdG9yZWQsIGFmdGVyIGFsbCB0aGUgbWFuYWdlZFxuXHRcdCAqIG9iamVjdHMgaGF2ZSBiZWVuIHJlY3JlYXRlZC5cblx0XHQgKlxuXHRcdCAqIFRoZSBmaXJzdCBhcmd1bWVudCBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIGlzIHRoZSBXZWJHTENvbnRleHRcblx0XHQgKiB3aGljaCBtYW5hZ2VkIHRoZSByZXN0b3JhdGlvbi5cblx0XHQgKlxuXHRcdCAqIFRoaXMgZG9lcyBub3QgZ2F1cmVudGVlIHRoYXQgYWxsIG9iamVjdHMgd2lsbCBiZSByZW5kZXJhYmxlLlxuXHRcdCAqIEZvciBleGFtcGxlLCBhIFRleHR1cmUgd2l0aCBhbiBJbWFnZVByb3ZpZGVyIG1heSBzdGlsbCBiZSBsb2FkaW5nXG5cdFx0ICogYXN5bmNocm9ub3VzbHkuXHQgXG5cdFx0ICogXG5cdFx0ICogQGV2ZW50IHtTaWduYWx9IHJlc3RvcmVkXG5cdFx0ICovXG5cdFx0dGhpcy5yZXN0b3JlZCA9IG5ldyBTaWduYWwoKTtcdFxuXHRcdFxuXHRcdC8vc2V0dXAgY29udGV4dCBsb3N0IGFuZCByZXN0b3JlIGxpc3RlbmVyc1xuXHRcdHRoaXMudmlldy5hZGRFdmVudExpc3RlbmVyKFwid2ViZ2xjb250ZXh0bG9zdFwiLCBmdW5jdGlvbiAoZXYpIHtcblx0XHRcdGV2LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHR0aGlzLl9jb250ZXh0TG9zdChldik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHR0aGlzLnZpZXcuYWRkRXZlbnRMaXN0ZW5lcihcIndlYmdsY29udGV4dHJlc3RvcmVkXCIsIGZ1bmN0aW9uIChldikge1xuXHRcdFx0ZXYucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMuX2NvbnRleHRSZXN0b3JlZChldik7XG5cdFx0fS5iaW5kKHRoaXMpKTtcblx0XHRcdFxuXHRcdHRoaXMuX2luaXRDb250ZXh0KCk7XG5cblx0XHR0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cdFxuXHRfaW5pdENvbnRleHQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBlcnIgPSBcIlwiO1xuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLmdsID0gKHRoaXMudmlldy5nZXRDb250ZXh0KCd3ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpIFxuXHRcdFx0XHRcdFx0fHwgdGhpcy52aWV3LmdldENvbnRleHQoJ2V4cGVyaW1lbnRhbC13ZWJnbCcsIHRoaXMuY29udGV4dEF0dHJpYnV0ZXMpKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHR0aGlzLmdsID0gbnVsbDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5nbCkge1xuXHRcdFx0dGhpcy52YWxpZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IFwiV2ViR0wgQ29udGV4dCBOb3QgU3VwcG9ydGVkIC0tIHRyeSBlbmFibGluZyBpdCBvciB1c2luZyBhIGRpZmZlcmVudCBicm93c2VyXCI7XG5cdFx0fVx0XG5cdH0sXG5cblx0LyoqXG5cdCAqIFVwZGF0ZXMgdGhlIHdpZHRoIGFuZCBoZWlnaHQgb2YgdGhpcyBXZWJHTCBjb250ZXh0LCByZXNpemVzXG5cdCAqIHRoZSBjYW52YXMgdmlldywgYW5kIGNhbGxzIGdsLnZpZXdwb3J0KCkgd2l0aCB0aGUgbmV3IHNpemUuXG5cdCAqIFxuXHQgKiBAcGFyYW0gIHtOdW1iZXJ9IHdpZHRoICB0aGUgbmV3IHdpZHRoXG5cdCAqIEBwYXJhbSAge051bWJlcn0gaGVpZ2h0IHRoZSBuZXcgaGVpZ2h0XG5cdCAqL1xuXHRyZXNpemU6IGZ1bmN0aW9uKHdpZHRoLCBoZWlnaHQpIHtcblx0XHR0aGlzLndpZHRoID0gd2lkdGg7XG5cdFx0dGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG5cblx0XHR0aGlzLnZpZXcud2lkdGggPSB3aWR0aDtcblx0XHR0aGlzLnZpZXcuaGVpZ2h0ID0gaGVpZ2h0O1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIChpbnRlcm5hbCB1c2UpXG5cdCAqIEEgbWFuYWdlZCBvYmplY3QgaXMgYW55dGhpbmcgd2l0aCBhIFwiY3JlYXRlXCIgZnVuY3Rpb24sIHRoYXQgd2lsbFxuXHQgKiByZXN0b3JlIEdMIHN0YXRlIGFmdGVyIGNvbnRleHQgbG9zcy4gXG5cdCAqIFxuXHQgKiBAcGFyYW0ge1t0eXBlXX0gdGV4IFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGFkZE1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMucHVzaChvYmopO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiAoaW50ZXJuYWwgdXNlKVxuXHQgKiBSZW1vdmVzIGEgbWFuYWdlZCBvYmplY3QgZnJvbSB0aGUgY2FjaGUuIFRoaXMgaXMgdXNlZnVsIHRvIGRlc3Ryb3lcblx0ICogYSB0ZXh0dXJlIG9yIHNoYWRlciwgYW5kIGhhdmUgaXQgbm8gbG9uZ2VyIHJlLWxvYWQgb24gY29udGV4dCByZXN0b3JlLlxuXHQgKlxuXHQgKiBSZXR1cm5zIHRoZSBvYmplY3QgdGhhdCB3YXMgcmVtb3ZlZCwgb3IgbnVsbCBpZiBpdCB3YXMgbm90IGZvdW5kIGluIHRoZSBjYWNoZS5cblx0ICogXG5cdCAqIEBwYXJhbSAge09iamVjdH0gb2JqIHRoZSBvYmplY3QgdG8gYmUgbWFuYWdlZFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9ICAgICB0aGUgcmVtb3ZlZCBvYmplY3QsIG9yIG51bGxcblx0ICovXG5cdHJlbW92ZU1hbmFnZWRPYmplY3Q6IGZ1bmN0aW9uKG9iaikge1xuXHRcdHZhciBpZHggPSB0aGlzLm1hbmFnZWRPYmplY3RzLmluZGV4T2Yob2JqKTtcblx0XHRpZiAoaWR4ID4gLTEpIHtcblx0XHRcdHRoaXMubWFuYWdlZE9iamVjdHMuc3BsaWNlKGlkeCwgMSk7XG5cdFx0XHRyZXR1cm4gb2JqO1xuXHRcdH0gXG5cdFx0cmV0dXJuIG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIENhbGxzIGRlc3Ryb3koKSBvbiBlYWNoIG1hbmFnZWQgb2JqZWN0LCB0aGVuIHJlbW92ZXMgcmVmZXJlbmNlcyB0byB0aGVzZSBvYmplY3RzXG5cdCAqIGFuZCB0aGUgR0wgcmVuZGVyaW5nIGNvbnRleHQuIFRoaXMgYWxzbyByZW1vdmVzIHJlZmVyZW5jZXMgdG8gdGhlIHZpZXcgYW5kIHNldHNcblx0ICogdGhlIGNvbnRleHQncyB3aWR0aCBhbmQgaGVpZ2h0IHRvIHplcm8uXG5cdCAqXG5cdCAqIEF0dGVtcHRpbmcgdG8gdXNlIHRoaXMgV2ViR0xDb250ZXh0IG9yIHRoZSBHTCByZW5kZXJpbmcgY29udGV4dCBhZnRlciBkZXN0cm95aW5nIGl0XG5cdCAqIHdpbGwgbGVhZCB0byB1bmRlZmluZWQgYmVoYXZpb3VyLlxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBvYmogPSB0aGlzLm1hbmFnZWRPYmplY3RzW2ldO1xuXHRcdFx0aWYgKG9iaiAmJiB0eXBlb2Ygb2JqLmRlc3Ryb3kpXG5cdFx0XHRcdG9iai5kZXN0cm95KCk7XG5cdFx0fVxuXHRcdHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoID0gMDtcblx0XHR0aGlzLnZhbGlkID0gZmFsc2U7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy52aWV3ID0gbnVsbDtcblx0XHR0aGlzLndpZHRoID0gdGhpcy5oZWlnaHQgPSAwO1xuXHR9LFxuXG5cdF9jb250ZXh0TG9zdDogZnVuY3Rpb24oZXYpIHtcblx0XHQvL2FsbCB0ZXh0dXJlcy9zaGFkZXJzL2J1ZmZlcnMvRkJPcyBoYXZlIGJlZW4gZGVsZXRlZC4uLiBcblx0XHQvL3dlIG5lZWQgdG8gcmUtY3JlYXRlIHRoZW0gb24gcmVzdG9yZVxuXHRcdHRoaXMudmFsaWQgPSBmYWxzZTtcblxuXHRcdHRoaXMubG9zdC5kaXNwYXRjaCh0aGlzKTtcblx0fSxcblxuXHRfY29udGV4dFJlc3RvcmVkOiBmdW5jdGlvbihldikge1xuXHRcdC8vZmlyc3QsIGluaXRpYWxpemUgdGhlIEdMIGNvbnRleHQgYWdhaW5cblx0XHR0aGlzLl9pbml0Q29udGV4dCgpO1xuXG5cdFx0Ly9ub3cgd2UgcmVjcmVhdGUgb3VyIHNoYWRlcnMgYW5kIHRleHR1cmVzXG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMubWFuYWdlZE9iamVjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRoaXMubWFuYWdlZE9iamVjdHNbaV0uY3JlYXRlKCk7XG5cdFx0fVxuXG5cdFx0Ly91cGRhdGUgR0wgdmlld3BvcnRcblx0XHR0aGlzLnJlc2l6ZSh0aGlzLndpZHRoLCB0aGlzLmhlaWdodCk7XG5cblx0XHR0aGlzLnJlc3RvcmVkLmRpc3BhdGNoKHRoaXMpO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJHTENvbnRleHQ7IiwidmFyIENsYXNzID0gcmVxdWlyZSgna2xhc3NlJyk7XG52YXIgVGV4dHVyZSA9IHJlcXVpcmUoJy4uL1RleHR1cmUnKTtcblxuXG52YXIgRnJhbWVCdWZmZXIgPSBuZXcgQ2xhc3Moe1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IEZyYW1lIEJ1ZmZlciBPYmplY3Qgd2l0aCB0aGUgZ2l2ZW4gd2lkdGggYW5kIGhlaWdodC5cblx0ICpcblx0ICogSWYgd2lkdGggYW5kIGhlaWdodCBhcmUgbm9uLW51bWJlcnMsIHRoaXMgbWV0aG9kIGV4cGVjdHMgdGhlXG5cdCAqIGZpcnN0IHBhcmFtZXRlciB0byBiZSBhIFRleHR1cmUgb2JqZWN0IHdoaWNoIHNob3VsZCBiZSBhY3RlZCB1cG9uLiBcblx0ICogSW4gdGhpcyBjYXNlLCB0aGUgRnJhbWVCdWZmZXIgZG9lcyBub3QgXCJvd25cIiB0aGUgdGV4dHVyZSwgYW5kIHNvIGl0XG5cdCAqIHdvbid0IGRpc3Bvc2Ugb2YgaXQgdXBvbiBkZXN0cnVjdGlvbi4gVGhpcyBpcyBhbiBhZHZhbmNlZCB2ZXJzaW9uIG9mIHRoZVxuXHQgKiBjb25zdHJ1Y3RvciB0aGF0IGFzc3VtZXMgdGhlIHVzZXIgaXMgZ2l2aW5nIHVzIGEgdmFsaWQgVGV4dHVyZSB0aGF0IGNhbiBiZSBib3VuZCAoaS5lLlxuXHQgKiBubyBhc3luYyBJbWFnZSB0ZXh0dXJlcykuXG5cdCAqXG5cdCAqIEBjbGFzcyAgRnJhbWVCdWZmZXJcblx0ICogQGNvbnN0cnVjdG9yXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gd2lkdGggIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSBoZWlnaHQgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19IGZpbHRlciBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgIFtkZXNjcmlwdGlvbl1cblx0ICovXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uIEZyYW1lQnVmZmVyKGNvbnRleHQsIHdpZHRoLCBoZWlnaHQsIGZvcm1hdCkgeyAvL1RPRE86IGRlcHRoIGNvbXBvbmVudFxuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIEZyYW1lQnVmZmVyXCI7XG5cdFxuXG5cdFx0LyoqXG5cdFx0ICogVGhlIHVuZGVybHlpbmcgSUQgb2YgdGhlIEdMIGZyYW1lIGJ1ZmZlciBvYmplY3QuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1dlYkdMRnJhbWVidWZmZXJ9IGlkXG5cdFx0ICovXHRcdFxuXHRcdHRoaXMuaWQgPSBudWxsO1xuXG5cdFx0LyoqXG5cdFx0ICogVGhlIFdlYkdMQ29udGV4dCBiYWNrZWQgYnkgdGhpcyBmcmFtZSBidWZmZXIuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1dlYkdMQ29udGV4dH0gY29udGV4dFxuXHRcdCAqL1xuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cblx0XHQvKipcblx0XHQgKiBUaGUgVGV4dHVyZSBiYWNrZWQgYnkgdGhpcyBmcmFtZSBidWZmZXIuXG5cdFx0ICpcblx0XHQgKiBAcHJvcGVydHkge1RleHR1cmV9IFRleHR1cmVcblx0XHQgKi9cblx0XHQvL3RoaXMgVGV4dHVyZSBpcyBub3cgbWFuYWdlZC5cblx0XHR0aGlzLnRleHR1cmUgPSBuZXcgVGV4dHVyZShjb250ZXh0LCB3aWR0aCwgaGVpZ2h0LCBmb3JtYXQpO1xuXG5cdFx0Ly9UaGlzIGlzIG1hYW5nZWQgYnkgV2ViR0xDb250ZXh0XG5cdFx0dGhpcy5jb250ZXh0LmFkZE1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKipcblx0ICogQSByZWFkLW9ubHkgcHJvcGVydHkgd2hpY2ggcmV0dXJucyB0aGUgd2lkdGggb2YgdGhlIGJhY2tpbmcgdGV4dHVyZS4gXG5cdCAqIFxuXHQgKiBAcmVhZE9ubHlcblx0ICogQHByb3BlcnR5IHdpZHRoXG5cdCAqIEB0eXBlIHtOdW1iZXJ9XG5cdCAqL1xuXHR3aWR0aDoge1xuXHRcdGdldDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50ZXh0dXJlLndpZHRoXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIHJlYWQtb25seSBwcm9wZXJ0eSB3aGljaCByZXR1cm5zIHRoZSBoZWlnaHQgb2YgdGhlIGJhY2tpbmcgdGV4dHVyZS4gXG5cdCAqIFxuXHQgKiBAcmVhZE9ubHlcblx0ICogQHByb3BlcnR5IGhlaWdodFxuXHQgKiBAdHlwZSB7TnVtYmVyfVxuXHQgKi9cblx0aGVpZ2h0OiB7XG5cdFx0Z2V0OiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiB0aGlzLnRleHR1cmUuaGVpZ2h0O1xuXHRcdH1cblx0fSxcblxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgZHVyaW5nIGluaXRpYWxpemF0aW9uIHRvIHNldHVwIHRoZSBmcmFtZSBidWZmZXI7IGFsc28gY2FsbGVkIG9uXG5cdCAqIGNvbnRleHQgcmVzdG9yZS4gVXNlcnMgd2lsbCBub3QgbmVlZCB0byBjYWxsIHRoaXMgZGlyZWN0bHkuXG5cdCAqIFxuXHQgKiBAbWV0aG9kIGNyZWF0ZVxuXHQgKi9cblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsOyBcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0dmFyIHRleCA9IHRoaXMudGV4dHVyZTtcblxuXHRcdC8vd2UgYXNzdW1lIHRoZSB0ZXh0dXJlIGhhcyBhbHJlYWR5IGhhZCBjcmVhdGUoKSBjYWxsZWQgb24gaXRcblx0XHQvL3NpbmNlIGl0IHdhcyBhZGRlZCBhcyBhIG1hbmFnZWQgb2JqZWN0IHByaW9yIHRvIHRoaXMgRnJhbWVCdWZmZXJcblx0XHR0ZXguYmluZCgpO1xuIFxuXHRcdHRoaXMuaWQgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5pZCk7XG5cblx0XHRnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIHRleC50YXJnZXQsIHRleC5pZCwgMCk7XG5cblx0XHR2YXIgcmVzdWx0ID0gZ2wuY2hlY2tGcmFtZWJ1ZmZlclN0YXR1cyhnbC5GUkFNRUJVRkZFUik7XG5cdFx0aWYgKHJlc3VsdCAhPSBnbC5GUkFNRUJVRkZFUl9DT01QTEVURSkge1xuXHRcdFx0dGhpcy5kZXN0cm95KCk7IC8vZGVzdHJveSBvdXIgcmVzb3VyY2VzIGJlZm9yZSBsZWF2aW5nIHRoaXMgZnVuY3Rpb24uLlxuXG5cdFx0XHR2YXIgZXJyID0gXCJGcmFtZWJ1ZmZlciBub3QgY29tcGxldGVcIjtcblx0XHRcdHN3aXRjaCAocmVzdWx0KSB7XG5cdFx0XHRcdGNhc2UgZ2wuRlJBTUVCVUZGRVJfVU5TVVBQT1JURUQ6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiB1bnN1cHBvcnRlZFwiKTtcblx0XHRcdFx0Y2FzZSBnbC5JTkNPTVBMRVRFX0RJTUVOU0lPTlM6XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVyciArIFwiOiBpbmNvbXBsZXRlIGRpbWVuc2lvbnNcIik7XG5cdFx0XHRcdGNhc2UgZ2wuSU5DT01QTEVURV9BVFRBQ0hNRU5UOlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIgKyBcIjogaW5jb21wbGV0ZSBhdHRhY2htZW50XCIpO1xuXHRcdFx0XHRjYXNlIGdsLklOQ09NUExFVEVfTUlTU0lOR19BVFRBQ0hNRU5UOlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIgKyBcIjogbWlzc2luZyBhdHRhY2htZW50XCIpO1xuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihlcnIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuXHR9LFxuXG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzIHRoaXMgZnJhbWUgYnVmZmVyLiBVc2luZyB0aGlzIG9iamVjdCBhZnRlciBkZXN0cm95aW5nIGl0IHdpbGwgaGF2ZVxuXHQgKiB1bmRlZmluZWQgcmVzdWx0cy4gXG5cdCAqIEBtZXRob2QgZGVzdHJveVxuXHQgKi9cblx0ZGVzdHJveTogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdGlmICh0aGlzLnRleHR1cmUpXG5cdFx0XHR0aGlzLnRleHR1cmUuZGVzdHJveSgpO1xuXHRcdGlmICh0aGlzLmlkICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUZyYW1lYnVmZmVyKHRoaXMuaWQpO1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdHRoaXMuaWQgPSBudWxsO1xuXHRcdHRoaXMudGV4dHVyZSA9IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEJpbmRzIHRoaXMgZnJhbWVidWZmZXIgYW5kIHNldHMgdGhlIHZpZXdwb3J0IHRvIHRoZSBleHBlY3RlZCBzaXplLlxuXHQgKiBAbWV0aG9kIGJlZ2luXG5cdCAqL1xuXHRiZWdpbjogZnVuY3Rpb24oKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRnbC52aWV3cG9ydCgwLCAwLCB0aGlzLnRleHR1cmUud2lkdGgsIHRoaXMudGV4dHVyZS5oZWlnaHQpO1xuXHRcdGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgdGhpcy5pZCk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEJpbmRzIHRoZSBkZWZhdWx0IGZyYW1lIGJ1ZmZlciAodGhlIHNjcmVlbikgYW5kIHNldHMgdGhlIHZpZXdwb3J0IGJhY2tcblx0ICogdG8gdGhlIHNpemUgb2YgdGhlIFdlYkdMQ29udGV4dC5cblx0ICogXG5cdCAqIEBtZXRob2QgZW5kXG5cdCAqL1xuXHRlbmQ6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0Z2wudmlld3BvcnQoMCwgMCwgdGhpcy5jb250ZXh0LndpZHRoLCB0aGlzLmNvbnRleHQuaGVpZ2h0KTtcblx0XHRnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuXHR9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBGcmFtZUJ1ZmZlcjsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG4vL1RPRE86IGRlY291cGxlIGludG8gVkJPICsgSUJPIHV0aWxpdGllcyBcbi8qKlxuICogQSBtZXNoIGNsYXNzIHRoYXQgd3JhcHMgVkJPIGFuZCBJQk8uXG4gKlxuICogQGNsYXNzICBNZXNoXG4gKi9cbnZhciBNZXNoID0gbmV3IENsYXNzKHtcblxuXG5cdC8qKlxuXHQgKiBBIHdyaXRlLW9ubHkgcHJvcGVydHkgd2hpY2ggc2V0cyBib3RoIHZlcnRpY2VzIGFuZCBpbmRpY2VzIFxuXHQgKiBmbGFnIHRvIGRpcnR5IG9yIG5vdC4gXG5cdCAqXG5cdCAqIEBwcm9wZXJ0eSBkaXJ0eVxuXHQgKiBAdHlwZSB7Qm9vbGVhbn1cblx0ICogQHdyaXRlT25seVxuXHQgKi9cblx0ZGlydHk6IHtcblx0XHRzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuXHRcdFx0dGhpcy52ZXJ0aWNlc0RpcnR5ID0gdmFsO1xuXHRcdFx0dGhpcy5pbmRpY2VzRGlydHkgPSB2YWw7XG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IE1lc2ggd2l0aCB0aGUgcHJvdmlkZWQgcGFyYW1ldGVycy5cblx0ICpcblx0ICogSWYgbnVtSW5kaWNlcyBpcyAwIG9yIGZhbHN5LCBubyBpbmRleCBidWZmZXIgd2lsbCBiZSB1c2VkXG5cdCAqIGFuZCBpbmRpY2VzIHdpbGwgYmUgYW4gZW1wdHkgQXJyYXlCdWZmZXIgYW5kIGEgbnVsbCBpbmRleEJ1ZmZlci5cblx0ICogXG5cdCAqIElmIGlzU3RhdGljIGlzIHRydWUsIHRoZW4gdmVydGV4VXNhZ2UgYW5kIGluZGV4VXNhZ2Ugd2lsbFxuXHQgKiBiZSBzZXQgdG8gZ2wuU1RBVElDX0RSQVcuIE90aGVyd2lzZSB0aGV5IHdpbGwgdXNlIGdsLkRZTkFNSUNfRFJBVy5cblx0ICogWW91IG1heSB3YW50IHRvIGFkanVzdCB0aGVzZSBhZnRlciBpbml0aWFsaXphdGlvbiBmb3IgZnVydGhlciBjb250cm9sLlxuXHQgKiBcblx0ICogQHBhcmFtICB7V2ViR0xDb250ZXh0fSAgY29udGV4dCB0aGUgY29udGV4dCBmb3IgbWFuYWdlbWVudFxuXHQgKiBAcGFyYW0gIHtCb29sZWFufSBpc1N0YXRpYyAgICAgIGEgaGludCBhcyB0byB3aGV0aGVyIHRoaXMgZ2VvbWV0cnkgaXMgc3RhdGljXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gIG51bVZlcnRzICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKiBAcGFyYW0gIHtbdHlwZV19ICBudW1JbmRpY2VzICAgIFtkZXNjcmlwdGlvbl1cblx0ICogQHBhcmFtICB7W3R5cGVdfSAgdmVydGV4QXR0cmlicyBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICAgICAgW2Rlc2NyaXB0aW9uXVxuXHQgKi9cblx0aW5pdGlhbGl6ZTogZnVuY3Rpb24gTWVzaChjb250ZXh0LCBpc1N0YXRpYywgbnVtVmVydHMsIG51bUluZGljZXMsIHZlcnRleEF0dHJpYnMpIHtcblx0XHRpZiAodHlwZW9mIGNvbnRleHQgIT09IFwib2JqZWN0XCIpXG5cdFx0XHR0aHJvdyBcIkdMIGNvbnRleHQgbm90IHNwZWNpZmllZCB0byBNZXNoXCI7XG5cdFx0aWYgKCFudW1WZXJ0cylcblx0XHRcdHRocm93IFwibnVtVmVydHMgbm90IHNwZWNpZmllZCwgbXVzdCBiZSA+IDBcIjtcblxuXHRcdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cdFx0dGhpcy5nbCA9IGNvbnRleHQuZ2w7XG5cdFx0XG5cdFx0dGhpcy5udW1WZXJ0cyA9IG51bGw7XG5cdFx0dGhpcy5udW1JbmRpY2VzID0gbnVsbDtcblx0XHRcblx0XHR0aGlzLnZlcnRpY2VzID0gbnVsbDtcblx0XHR0aGlzLmluZGljZXMgPSBudWxsO1xuXHRcdHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcblx0XHR0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcblxuXHRcdHRoaXMudmVydGljZXNEaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy5pbmRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMuaW5kZXhVc2FnZSA9IG51bGw7XG5cdFx0dGhpcy52ZXJ0ZXhVc2FnZSA9IG51bGw7XG5cblx0XHQvKiogXG5cdFx0ICogQHByb3BlcnR5XG5cdFx0ICogQHByaXZhdGVcblx0XHQgKi9cblx0XHR0aGlzLl92ZXJ0ZXhBdHRyaWJzID0gbnVsbDtcblxuXHRcdC8qKiBcblx0XHQgKiBAcHJvcGVydHlcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqL1xuXHRcdHRoaXMuX3ZlcnRleFN0cmlkZSA9IG51bGw7XG5cblx0XHR0aGlzLm51bVZlcnRzID0gbnVtVmVydHM7XG5cdFx0dGhpcy5udW1JbmRpY2VzID0gbnVtSW5kaWNlcyB8fCAwO1xuXHRcdHRoaXMudmVydGV4VXNhZ2UgPSBpc1N0YXRpYyA/IHRoaXMuZ2wuU1RBVElDX0RSQVcgOiB0aGlzLmdsLkRZTkFNSUNfRFJBVztcblx0XHR0aGlzLmluZGV4VXNhZ2UgID0gaXNTdGF0aWMgPyB0aGlzLmdsLlNUQVRJQ19EUkFXIDogdGhpcy5nbC5EWU5BTUlDX0RSQVc7XG5cdFx0dGhpcy5fdmVydGV4QXR0cmlicyA9IHZlcnRleEF0dHJpYnMgfHwgW107XG5cdFx0XG5cdFx0dGhpcy5pbmRpY2VzRGlydHkgPSB0cnVlO1xuXHRcdHRoaXMudmVydGljZXNEaXJ0eSA9IHRydWU7XG5cblx0XHQvL2RldGVybWluZSB0aGUgdmVydGV4IHN0cmlkZSBiYXNlZCBvbiBnaXZlbiBhdHRyaWJ1dGVzXG5cdFx0dmFyIHRvdGFsTnVtQ29tcG9uZW50cyA9IDA7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPHRoaXMuX3ZlcnRleEF0dHJpYnMubGVuZ3RoOyBpKyspXG5cdFx0XHR0b3RhbE51bUNvbXBvbmVudHMgKz0gdGhpcy5fdmVydGV4QXR0cmlic1tpXS5vZmZzZXRDb3VudDtcblx0XHR0aGlzLl92ZXJ0ZXhTdHJpZGUgPSB0b3RhbE51bUNvbXBvbmVudHMgKiA0OyAvLyBpbiBieXRlc1xuXG5cdFx0dGhpcy52ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGhpcy5udW1WZXJ0cyk7XG5cdFx0dGhpcy5pbmRpY2VzID0gbmV3IFVpbnQxNkFycmF5KHRoaXMubnVtSW5kaWNlcyk7XG5cblx0XHQvL2FkZCB0aGlzIFZCTyB0byB0aGUgbWFuYWdlZCBjYWNoZVxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvL3JlY3JlYXRlcyB0aGUgYnVmZmVycyBvbiBjb250ZXh0IGxvc3Ncblx0Y3JlYXRlOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsID0gdGhpcy5jb250ZXh0LmdsO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dGhpcy52ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcblxuXHRcdC8vaWdub3JlIGluZGV4IGJ1ZmZlciBpZiB3ZSBoYXZlbid0IHNwZWNpZmllZCBhbnlcblx0XHR0aGlzLmluZGV4QnVmZmVyID0gdGhpcy5udW1JbmRpY2VzID4gMFxuXHRcdFx0XHRcdD8gZ2wuY3JlYXRlQnVmZmVyKClcblx0XHRcdFx0XHQ6IG51bGw7XG5cblx0XHR0aGlzLmRpcnR5ID0gdHJ1ZTtcblx0fSxcblxuXHRkZXN0cm95OiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLnZlcnRpY2VzID0gW107XG5cdFx0dGhpcy5pbmRpY2VzID0gW107XG5cdFx0aWYgKHRoaXMudmVydGV4QnVmZmVyICYmIHRoaXMuZ2wpXG5cdFx0XHR0aGlzLmdsLmRlbGV0ZUJ1ZmZlcih0aGlzLnZlcnRleEJ1ZmZlcik7XG5cdFx0aWYgKHRoaXMuaW5kZXhCdWZmZXIgJiYgdGhpcy5nbClcblx0XHRcdHRoaXMuZ2wuZGVsZXRlQnVmZmVyKHRoaXMuaW5kZXhCdWZmZXIpO1xuXHRcdHRoaXMudmVydGV4QnVmZmVyID0gbnVsbDtcblx0XHR0aGlzLmluZGV4QnVmZmVyID0gbnVsbDtcblx0XHRpZiAodGhpcy5jb250ZXh0KVxuXHRcdFx0dGhpcy5jb250ZXh0LnJlbW92ZU1hbmFnZWRPYmplY3QodGhpcyk7XG5cdFx0dGhpcy5nbCA9IG51bGw7XG5cdFx0dGhpcy5jb250ZXh0ID0gbnVsbDtcblx0fSxcblxuXHRfdXBkYXRlQnVmZmVyczogZnVuY3Rpb24oaWdub3JlQmluZCwgc3ViRGF0YUxlbmd0aCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL2JpbmQgb3VyIGluZGV4IGRhdGEsIGlmIHdlIGhhdmUgYW55XG5cdFx0aWYgKHRoaXMubnVtSW5kaWNlcyA+IDApIHtcblx0XHRcdGlmICghaWdub3JlQmluZClcblx0XHRcdFx0Z2wuYmluZEJ1ZmZlcihnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRleEJ1ZmZlcik7XG5cblx0XHRcdC8vdXBkYXRlIHRoZSBpbmRleCBkYXRhXG5cdFx0XHRpZiAodGhpcy5pbmRpY2VzRGlydHkpIHtcblx0XHRcdFx0Z2wuYnVmZmVyRGF0YShnbC5FTEVNRU5UX0FSUkFZX0JVRkZFUiwgdGhpcy5pbmRpY2VzLCB0aGlzLmluZGV4VXNhZ2UpO1xuXHRcdFx0XHR0aGlzLmluZGljZXNEaXJ0eSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vYmluZCBvdXIgdmVydGV4IGRhdGFcblx0XHRpZiAoIWlnbm9yZUJpbmQpXG5cdFx0XHRnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgdGhpcy52ZXJ0ZXhCdWZmZXIpO1xuXG5cdFx0Ly91cGRhdGUgb3VyIHZlcnRleCBkYXRhXG5cdFx0aWYgKHRoaXMudmVydGljZXNEaXJ0eSkge1xuXHRcdFx0aWYgKHN1YkRhdGFMZW5ndGgpIHtcblx0XHRcdFx0Ly8gVE9ETzogV2hlbiBkZWNvdXBsaW5nIFZCTy9JQk8gYmUgc3VyZSB0byBnaXZlIGJldHRlciBzdWJEYXRhIHN1cHBvcnQuLlxuXHRcdFx0XHR2YXIgdmlldyA9IHRoaXMudmVydGljZXMuc3ViYXJyYXkoMCwgc3ViRGF0YUxlbmd0aCk7XG5cdFx0XHRcdGdsLmJ1ZmZlclN1YkRhdGEoZ2wuQVJSQVlfQlVGRkVSLCAwLCB2aWV3KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCB0aGlzLnZlcnRpY2VzLCB0aGlzLnZlcnRleFVzYWdlKTtcdFxuXHRcdFx0fVxuXG5cdFx0XHRcblx0XHRcdHRoaXMudmVydGljZXNEaXJ0eSA9IGZhbHNlO1xuXHRcdH1cblx0fSxcblxuXHRkcmF3OiBmdW5jdGlvbihwcmltaXRpdmVUeXBlLCBjb3VudCwgb2Zmc2V0LCBzdWJEYXRhTGVuZ3RoKSB7XG5cdFx0aWYgKGNvdW50ID09PSAwKVxuXHRcdFx0cmV0dXJuO1xuXG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHRcblx0XHRvZmZzZXQgPSBvZmZzZXQgfHwgMDtcblxuXHRcdC8vYmluZHMgYW5kIHVwZGF0ZXMgb3VyIGJ1ZmZlcnMuIHBhc3MgaWdub3JlQmluZCBhcyB0cnVlXG5cdFx0Ly90byBhdm9pZCBiaW5kaW5nIHVubmVjZXNzYXJpbHlcblx0XHR0aGlzLl91cGRhdGVCdWZmZXJzKHRydWUsIHN1YkRhdGFMZW5ndGgpO1xuXG5cdFx0aWYgKHRoaXMubnVtSW5kaWNlcyA+IDApIHsgXG5cdFx0XHRnbC5kcmF3RWxlbWVudHMocHJpbWl0aXZlVHlwZSwgY291bnQsIFxuXHRcdFx0XHRcdFx0Z2wuVU5TSUdORURfU0hPUlQsIG9mZnNldCAqIDIpOyAvLyogVWludDE2QXJyYXkuQllURVNfUEVSX0VMRU1FTlRcblx0XHR9IGVsc2Vcblx0XHRcdGdsLmRyYXdBcnJheXMocHJpbWl0aXZlVHlwZSwgb2Zmc2V0LCBjb3VudCk7XG5cdH0sXG5cblx0Ly9iaW5kcyB0aGlzIG1lc2gncyB2ZXJ0ZXggYXR0cmlidXRlcyBmb3IgdGhlIGdpdmVuIHNoYWRlclxuXHRiaW5kOiBmdW5jdGlvbihzaGFkZXIpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXG5cdFx0dmFyIG9mZnNldCA9IDA7XG5cdFx0dmFyIHN0cmlkZSA9IHRoaXMuX3ZlcnRleFN0cmlkZTtcblxuXHRcdC8vYmluZCBhbmQgdXBkYXRlIG91ciB2ZXJ0ZXggZGF0YSBiZWZvcmUgYmluZGluZyBhdHRyaWJ1dGVzXG5cdFx0dGhpcy5fdXBkYXRlQnVmZmVycygpO1xuXG5cdFx0Ly9mb3IgZWFjaCBhdHRyaWJ0dWVcblx0XHRmb3IgKHZhciBpPTA7IGk8dGhpcy5fdmVydGV4QXR0cmlicy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGEgPSB0aGlzLl92ZXJ0ZXhBdHRyaWJzW2ldO1xuXG5cdFx0XHQvL2xvY2F0aW9uIG9mIHRoZSBhdHRyaWJ1dGVcblx0XHRcdHZhciBsb2MgPSBhLmxvY2F0aW9uID09PSBudWxsIFxuXHRcdFx0XHRcdD8gc2hhZGVyLmdldEF0dHJpYnV0ZUxvY2F0aW9uKGEubmFtZSlcblx0XHRcdFx0XHQ6IGEubG9jYXRpb247XG5cblx0XHRcdC8vVE9ETzogV2UgbWF5IHdhbnQgdG8gc2tpcCB1bmZvdW5kIGF0dHJpYnNcblx0XHRcdC8vIGlmIChsb2MhPT0wICYmICFsb2MpXG5cdFx0XHQvLyBcdGNvbnNvbGUud2FybihcIldBUk46XCIsIGEubmFtZSwgXCJpcyBub3QgZW5hYmxlZFwiKTtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGxvYyk7XG5cblx0XHRcdC8vdGhlbiBzcGVjaWZ5IG91ciB2ZXJ0ZXggZm9ybWF0XG5cdFx0XHRnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKGxvYywgYS5udW1Db21wb25lbnRzLCBhLnR5cGUgfHwgZ2wuRkxPQVQsIFxuXHRcdFx0XHRcdFx0XHRcdCAgIGEubm9ybWFsaXplLCBzdHJpZGUsIG9mZnNldCk7XG5cblx0XHRcdC8vYW5kIGluY3JlYXNlIHRoZSBvZmZzZXQuLi5cblx0XHRcdG9mZnNldCArPSBhLm9mZnNldENvdW50ICogNDsgLy9pbiBieXRlc1xuXHRcdH1cblx0fSxcblxuXHR1bmJpbmQ6IGZ1bmN0aW9uKHNoYWRlcikge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHQvL2ZvciBlYWNoIGF0dHJpYnR1ZVxuXHRcdGZvciAodmFyIGk9MDsgaTx0aGlzLl92ZXJ0ZXhBdHRyaWJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR2YXIgYSA9IHRoaXMuX3ZlcnRleEF0dHJpYnNbaV07XG5cblx0XHRcdC8vbG9jYXRpb24gb2YgdGhlIGF0dHJpYnV0ZVxuXHRcdFx0dmFyIGxvYyA9IGEubG9jYXRpb24gPT09IG51bGwgXG5cdFx0XHRcdFx0PyBzaGFkZXIuZ2V0QXR0cmlidXRlTG9jYXRpb24oYS5uYW1lKVxuXHRcdFx0XHRcdDogYS5sb2NhdGlvbjtcblxuXHRcdFx0Ly9maXJzdCwgZW5hYmxlIHRoZSB2ZXJ0ZXggYXJyYXlcblx0XHRcdGdsLmRpc2FibGVWZXJ0ZXhBdHRyaWJBcnJheShsb2MpO1xuXHRcdH1cblx0fVxufSk7XG5cbk1lc2guQXR0cmliID0gbmV3IENsYXNzKHtcblxuXHRuYW1lOiBudWxsLFxuXHRudW1Db21wb25lbnRzOiBudWxsLFxuXHRsb2NhdGlvbjogbnVsbCxcblx0dHlwZTogbnVsbCxcblxuXHQvKipcblx0ICogTG9jYXRpb24gaXMgb3B0aW9uYWwgYW5kIGZvciBhZHZhbmNlZCB1c2VycyB0aGF0XG5cdCAqIHdhbnQgdmVydGV4IGFycmF5cyB0byBtYXRjaCBhY3Jvc3Mgc2hhZGVycy4gQW55IG5vbi1udW1lcmljYWxcblx0ICogdmFsdWUgd2lsbCBiZSBjb252ZXJ0ZWQgdG8gbnVsbCwgYW5kIGlnbm9yZWQuIElmIGEgbnVtZXJpY2FsXG5cdCAqIHZhbHVlIGlzIGdpdmVuLCBpdCB3aWxsIG92ZXJyaWRlIHRoZSBwb3NpdGlvbiBvZiB0aGlzIGF0dHJpYnV0ZVxuXHQgKiB3aGVuIGdpdmVuIHRvIGEgbWVzaC5cblx0ICogXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbmFtZSAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbnVtQ29tcG9uZW50cyBbZGVzY3JpcHRpb25dXG5cdCAqIEBwYXJhbSAge1t0eXBlXX0gbG9jYXRpb24gICAgICBbZGVzY3JpcHRpb25dXG5cdCAqIEByZXR1cm4ge1t0eXBlXX0gICAgICAgICAgICAgICBbZGVzY3JpcHRpb25dXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbihuYW1lLCBudW1Db21wb25lbnRzLCBsb2NhdGlvbiwgdHlwZSwgbm9ybWFsaXplLCBvZmZzZXRDb3VudCkge1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5udW1Db21wb25lbnRzID0gbnVtQ29tcG9uZW50cztcblx0XHR0aGlzLmxvY2F0aW9uID0gdHlwZW9mIGxvY2F0aW9uID09PSBcIm51bWJlclwiID8gbG9jYXRpb24gOiBudWxsO1xuXHRcdHRoaXMudHlwZSA9IHR5cGU7XG5cdFx0dGhpcy5ub3JtYWxpemUgPSBCb29sZWFuKG5vcm1hbGl6ZSk7XG5cdFx0dGhpcy5vZmZzZXRDb3VudCA9IHR5cGVvZiBvZmZzZXRDb3VudCA9PT0gXCJudW1iZXJcIiA/IG9mZnNldENvdW50IDogdGhpcy5udW1Db21wb25lbnRzO1xuXHR9XG59KVxuXG5cbm1vZHVsZS5leHBvcnRzID0gTWVzaDsiLCIvKipcbiAqIEBtb2R1bGUga2FtaVxuICovXG5cbnZhciBDbGFzcyA9IHJlcXVpcmUoJ2tsYXNzZScpO1xuXG5cbnZhciBTaGFkZXJQcm9ncmFtID0gbmV3IENsYXNzKHtcblx0XG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IFNoYWRlclByb2dyYW0gZnJvbSB0aGUgZ2l2ZW4gc291cmNlLCBhbmQgYW4gb3B0aW9uYWwgbWFwIG9mIGF0dHJpYnV0ZVxuXHQgKiBsb2NhdGlvbnMgYXMgPG5hbWUsIGluZGV4PiBwYWlycy5cblx0ICpcblx0ICogX05vdGU6XyBDaHJvbWUgdmVyc2lvbiAzMSB3YXMgZ2l2aW5nIG1lIGlzc3VlcyB3aXRoIGF0dHJpYnV0ZSBsb2NhdGlvbnMgLS0geW91IG1heVxuXHQgKiB3YW50IHRvIG9taXQgdGhpcyB0byBsZXQgdGhlIGJyb3dzZXIgcGljayB0aGUgbG9jYXRpb25zIGZvciB5b3UuXHRcblx0ICpcblx0ICogQGNsYXNzICBTaGFkZXJQcm9ncmFtXG5cdCAqIEBjb25zdHJ1Y3RvclxuXHQgKiBAcGFyYW0gIHtXZWJHTENvbnRleHR9IGNvbnRleHQgICAgICB0aGUgY29udGV4dCB0byBtYW5hZ2UgdGhpcyBvYmplY3Rcblx0ICogQHBhcmFtICB7U3RyaW5nfSB2ZXJ0U291cmNlICAgICAgICAgdGhlIHZlcnRleCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gZnJhZ1NvdXJjZSAgICAgICAgIHRoZSBmcmFnbWVudCBzaGFkZXIgc291cmNlXG5cdCAqIEBwYXJhbSAge09iamVjdH0gYXR0cmlidXRlTG9jYXRpb25zIHRoZSBhdHRyaWJ1dGUgbG9jYXRpb25zXG5cdCAqL1xuXHRpbml0aWFsaXplOiBmdW5jdGlvbiBTaGFkZXJQcm9ncmFtKGNvbnRleHQsIHZlcnRTb3VyY2UsIGZyYWdTb3VyY2UsIGF0dHJpYnV0ZUxvY2F0aW9ucykge1xuXHRcdGlmICghdmVydFNvdXJjZSB8fCAhZnJhZ1NvdXJjZSlcblx0XHRcdHRocm93IFwidmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzIG11c3QgYmUgZGVmaW5lZFwiO1xuXHRcdGlmICh0eXBlb2YgY29udGV4dCAhPT0gXCJvYmplY3RcIilcblx0XHRcdHRocm93IFwiR0wgY29udGV4dCBub3Qgc3BlY2lmaWVkIHRvIFNoYWRlclByb2dyYW1cIjtcblx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdFx0dGhpcy52ZXJ0U2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSBudWxsO1xuXHRcdHRoaXMucHJvZ3JhbSA9IG51bGw7XG5cdFx0dGhpcy5sb2cgPSBcIlwiO1xuXG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMuYXR0cmlidXRlQ2FjaGUgPSBudWxsO1xuXG5cdFx0dGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMgPSBhdHRyaWJ1dGVMb2NhdGlvbnM7XG5cblx0XHQvL1dlIHRyaW0gKEVDTUFTY3JpcHQ1KSBzbyB0aGF0IHRoZSBHTFNMIGxpbmUgbnVtYmVycyBhcmVcblx0XHQvL2FjY3VyYXRlIG9uIHNoYWRlciBsb2dcblx0XHR0aGlzLnZlcnRTb3VyY2UgPSB2ZXJ0U291cmNlLnRyaW0oKTtcblx0XHR0aGlzLmZyYWdTb3VyY2UgPSBmcmFnU291cmNlLnRyaW0oKTtcblxuXHRcdC8vQWRkcyB0aGlzIHNoYWRlciB0byB0aGUgY29udGV4dCwgdG8gYmUgbWFuYWdlZFxuXHRcdHRoaXMuY29udGV4dC5hZGRNYW5hZ2VkT2JqZWN0KHRoaXMpO1xuXG5cdFx0dGhpcy5jcmVhdGUoKTtcblx0fSxcblxuXHQvKiogXG5cdCAqIFRoaXMgaXMgY2FsbGVkIGR1cmluZyB0aGUgU2hhZGVyUHJvZ3JhbSBjb25zdHJ1Y3Rvcixcblx0ICogYW5kIG1heSBuZWVkIHRvIGJlIGNhbGxlZCBhZ2FpbiBhZnRlciBjb250ZXh0IGxvc3MgYW5kIHJlc3RvcmUuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBjcmVhdGVcblx0ICovXG5cdGNyZWF0ZTogZnVuY3Rpb24oKSB7XG5cdFx0dGhpcy5nbCA9IHRoaXMuY29udGV4dC5nbDtcblx0XHR0aGlzLl9jb21waWxlU2hhZGVycygpO1xuXHR9LFxuXG5cdC8vQ29tcGlsZXMgdGhlIHNoYWRlcnMsIHRocm93aW5nIGFuIGVycm9yIGlmIHRoZSBwcm9ncmFtIHdhcyBpbnZhbGlkLlxuXHRfY29tcGlsZVNoYWRlcnM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXHRcdFxuXHRcdHRoaXMubG9nID0gXCJcIjtcblxuXHRcdHRoaXMudmVydFNoYWRlciA9IHRoaXMuX2xvYWRTaGFkZXIoZ2wuVkVSVEVYX1NIQURFUiwgdGhpcy52ZXJ0U291cmNlKTtcblx0XHR0aGlzLmZyYWdTaGFkZXIgPSB0aGlzLl9sb2FkU2hhZGVyKGdsLkZSQUdNRU5UX1NIQURFUiwgdGhpcy5mcmFnU291cmNlKTtcblxuXHRcdGlmICghdGhpcy52ZXJ0U2hhZGVyIHx8ICF0aGlzLmZyYWdTaGFkZXIpXG5cdFx0XHR0aHJvdyBcIkVycm9yIHJldHVybmVkIHdoZW4gY2FsbGluZyBjcmVhdGVTaGFkZXJcIjtcblxuXHRcdHRoaXMucHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcblxuXHRcdGdsLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sIHRoaXMudmVydFNoYWRlcik7XG5cdFx0Z2wuYXR0YWNoU2hhZGVyKHRoaXMucHJvZ3JhbSwgdGhpcy5mcmFnU2hhZGVyKTtcblx0XG5cdFx0Ly9UT0RPOiBUaGlzIHNlZW1zIG5vdCB0byBiZSB3b3JraW5nIG9uIG15IE9TWCAtLSBtYXliZSBhIGRyaXZlciBidWc/XG5cdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zKSB7XG5cdFx0XHRmb3IgKHZhciBrZXkgaW4gdGhpcy5hdHRyaWJ1dGVMb2NhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0XHRnbC5iaW5kQXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLCBNYXRoLmZsb29yKHRoaXMuYXR0cmlidXRlTG9jYXRpb25zW2tleV0pLCBrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Z2wubGlua1Byb2dyYW0odGhpcy5wcm9ncmFtKTsgXG5cblx0XHR0aGlzLmxvZyArPSBnbC5nZXRQcm9ncmFtSW5mb0xvZyh0aGlzLnByb2dyYW0pIHx8IFwiXCI7XG5cblx0XHRpZiAoIWdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5MSU5LX1NUQVRVUykpIHtcblx0XHRcdHRocm93IFwiRXJyb3IgbGlua2luZyB0aGUgc2hhZGVyIHByb2dyYW06XFxuXCJcblx0XHRcdFx0KyB0aGlzLmxvZztcblx0XHR9XG5cblx0XHR0aGlzLl9mZXRjaFVuaWZvcm1zKCk7XG5cdFx0dGhpcy5fZmV0Y2hBdHRyaWJ1dGVzKCk7XG5cdH0sXG5cblx0X2ZldGNoVW5pZm9ybXM6IGZ1bmN0aW9uKCkge1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cblx0XHR0aGlzLnVuaWZvcm1DYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfVU5JRk9STVMpO1xuXHRcdGlmICghbGVuKSAvL251bGwgb3IgemVyb1xuXHRcdFx0cmV0dXJuO1xuXG5cdFx0Zm9yICh2YXIgaT0wOyBpPGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgaW5mbyA9IGdsLmdldEFjdGl2ZVVuaWZvcm0odGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblx0XHRcdHZhciBsb2NhdGlvbiA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLnVuaWZvcm1DYWNoZVtuYW1lXSA9IHtcblx0XHRcdFx0c2l6ZTogaW5mby5zaXplLFxuXHRcdFx0XHR0eXBlOiBpbmZvLnR5cGUsXG5cdFx0XHRcdGxvY2F0aW9uOiBsb2NhdGlvblxuXHRcdFx0fTtcblx0XHR9XG5cdH0sXG5cblx0X2ZldGNoQXR0cmlidXRlczogZnVuY3Rpb24oKSB7IFxuXHRcdHZhciBnbCA9IHRoaXMuZ2w7IFxuXG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IHt9O1xuXG5cdFx0dmFyIGxlbiA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLCBnbC5BQ1RJVkVfQVRUUklCVVRFUyk7XG5cdFx0aWYgKCFsZW4pIC8vbnVsbCBvciB6ZXJvXG5cdFx0XHRyZXR1cm47XHRcblxuXHRcdGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0dmFyIGluZm8gPSBnbC5nZXRBY3RpdmVBdHRyaWIodGhpcy5wcm9ncmFtLCBpKTtcblx0XHRcdGlmIChpbmZvID09PSBudWxsKSBcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR2YXIgbmFtZSA9IGluZm8ubmFtZTtcblxuXHRcdFx0Ly90aGUgYXR0cmliIGxvY2F0aW9uIGlzIGEgc2ltcGxlIGluZGV4XG5cdFx0XHR2YXIgbG9jYXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbih0aGlzLnByb2dyYW0sIG5hbWUpO1xuXHRcdFx0XG5cdFx0XHR0aGlzLmF0dHJpYnV0ZUNhY2hlW25hbWVdID0ge1xuXHRcdFx0XHRzaXplOiBpbmZvLnNpemUsXG5cdFx0XHRcdHR5cGU6IGluZm8udHlwZSxcblx0XHRcdFx0bG9jYXRpb246IGxvY2F0aW9uXG5cdFx0XHR9O1xuXHRcdH1cblx0fSxcblxuXHRfbG9hZFNoYWRlcjogZnVuY3Rpb24odHlwZSwgc291cmNlKSB7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblxuXHRcdHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIodHlwZSk7XG5cdFx0aWYgKCFzaGFkZXIpIC8vc2hvdWxkIG5vdCBvY2N1ci4uLlxuXHRcdFx0cmV0dXJuIC0xO1xuXG5cdFx0Z2wuc2hhZGVyU291cmNlKHNoYWRlciwgc291cmNlKTtcblx0XHRnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG5cdFx0XG5cdFx0dmFyIGxvZ1Jlc3VsdCA9IGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKSB8fCBcIlwiO1xuXHRcdGlmIChsb2dSZXN1bHQpIHtcblx0XHRcdC8vd2UgZG8gdGhpcyBzbyB0aGUgdXNlciBrbm93cyB3aGljaCBzaGFkZXIgaGFzIHRoZSBlcnJvclxuXHRcdFx0dmFyIHR5cGVTdHIgPSAodHlwZSA9PT0gZ2wuVkVSVEVYX1NIQURFUikgPyBcInZlcnRleFwiIDogXCJmcmFnbWVudFwiO1xuXHRcdFx0bG9nUmVzdWx0ID0gXCJFcnJvciBjb21waWxpbmcgXCIrIHR5cGVTdHIrIFwiIHNoYWRlcjpcXG5cIitsb2dSZXN1bHQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2cgKz0gbG9nUmVzdWx0O1xuXG5cdFx0aWYgKCFnbC5nZXRTaGFkZXJQYXJhbWV0ZXIoc2hhZGVyLCBnbC5DT01QSUxFX1NUQVRVUykgKSB7XG5cdFx0XHR0aHJvdyB0aGlzLmxvZztcblx0XHR9XG5cdFx0cmV0dXJuIHNoYWRlcjtcblx0fSxcblxuXHQvKipcblx0ICogQ2FsbGVkIHRvIGJpbmQgdGhpcyBzaGFkZXIuIE5vdGUgdGhhdCB0aGVyZSBpcyBubyBcInVuYmluZFwiIHNpbmNlXG5cdCAqIHRlY2huaWNhbGx5IHN1Y2ggYSB0aGluZyBpcyBub3QgcG9zc2libGUgaW4gdGhlIHByb2dyYW1tYWJsZSBwaXBlbGluZS5cblx0ICpcblx0ICogWW91IG11c3QgYmluZCBhIHNoYWRlciBiZWZvcmUgc2V0dGluZ3MgaXRzIHVuaWZvcm1zLlxuXHQgKiBcblx0ICogQG1ldGhvZCBiaW5kXG5cdCAqL1xuXHRiaW5kOiBmdW5jdGlvbigpIHtcblx0XHR0aGlzLmdsLnVzZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0fSxcblxuXG5cdC8qKlxuXHQgKiBEZXN0cm95cyB0aGlzIHNoYWRlciBhbmQgaXRzIHJlc291cmNlcy4gWW91IHNob3VsZCBub3QgdHJ5IHRvIHVzZSB0aGlzXG5cdCAqIGFmdGVyIGRlc3Ryb3lpbmcgaXQuXG5cdCAqIEBtZXRob2QgIGRlc3Ryb3lcblx0ICovXG5cdGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuXHRcdGlmICh0aGlzLmNvbnRleHQpXG5cdFx0XHR0aGlzLmNvbnRleHQucmVtb3ZlTWFuYWdlZE9iamVjdCh0aGlzKTtcblxuXHRcdGlmICh0aGlzLmdsKSB7XG5cdFx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdFx0Z2wuZGV0YWNoU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZXRhY2hTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblxuXHRcdFx0Z2wuZGVsZXRlU2hhZGVyKHRoaXMudmVydFNoYWRlcik7XG5cdFx0XHRnbC5kZWxldGVTaGFkZXIodGhpcy5mcmFnU2hhZGVyKTtcblx0XHRcdGdsLmRlbGV0ZVByb2dyYW0odGhpcy5wcm9ncmFtKTtcblx0XHR9XG5cdFx0dGhpcy5hdHRyaWJ1dGVDYWNoZSA9IG51bGw7XG5cdFx0dGhpcy51bmlmb3JtQ2FjaGUgPSBudWxsO1xuXHRcdHRoaXMudmVydFNoYWRlciA9IG51bGw7XG5cdFx0dGhpcy5mcmFnU2hhZGVyID0gbnVsbDtcblx0XHR0aGlzLnByb2dyYW0gPSBudWxsO1xuXHRcdHRoaXMuZ2wgPSBudWxsO1xuXHRcdHRoaXMuY29udGV4dCA9IG51bGw7XG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQgaW4gdGhlIGNhY2hlLCBpdCBpcyBhc3N1bWVkXG5cdCAqIHRvIG5vdCBleGlzdCwgYW5kIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogVGhpcyBtYXkgcmV0dXJuIG51bGwgZXZlbiBpZiB0aGUgdW5pZm9ybSBpcyBkZWZpbmVkIGluIEdMU0w6XG5cdCAqIGlmIGl0IGlzIF9pbmFjdGl2ZV8gKGkuZS4gbm90IHVzZWQgaW4gdGhlIHByb2dyYW0pIHRoZW4gaXQgbWF5XG5cdCAqIGJlIG9wdGltaXplZCBvdXQuXG5cdCAqXG5cdCAqIEBtZXRob2QgIGdldFVuaWZvcm1JbmZvXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplLCBhbmQgdHlwZVxuXHQgKi9cblx0Z2V0VW5pZm9ybUluZm86IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy51bmlmb3JtQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCBhdHRyaWJ1dGUgaW5mbyAoc2l6ZSwgdHlwZSwgbG9jYXRpb24pLlxuXHQgKiBJZiB0aGUgYXR0cmlidXRlIGlzIG5vdCBmb3VuZCBpbiB0aGUgY2FjaGUsIGl0IGlzIGFzc3VtZWRcblx0ICogdG8gbm90IGV4aXN0LCBhbmQgdGhpcyBtZXRob2QgcmV0dXJucyBudWxsLlxuXHQgKlxuXHQgKiBUaGlzIG1heSByZXR1cm4gbnVsbCBldmVuIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZGVmaW5lZCBpbiBHTFNMOlxuXHQgKiBpZiBpdCBpcyBfaW5hY3RpdmVfIChpLmUuIG5vdCB1c2VkIGluIHRoZSBwcm9ncmFtIG9yIGRpc2FibGVkKSBcblx0ICogdGhlbiBpdCBtYXkgYmUgb3B0aW1pemVkIG91dC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlSW5mb1xuXHQgKiBAcGFyYW0gIHtTdHJpbmd9IG5hbWUgdGhlIGF0dHJpYnV0ZSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCBjb250YWluaW5nIGxvY2F0aW9uLCBzaXplIGFuZCB0eXBlXG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVJbmZvOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXR0cmlidXRlQ2FjaGVbbmFtZV0gfHwgbnVsbDsgXG5cdH0sXG5cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgY2FjaGVkIHVuaWZvcm0gbG9jYXRpb24gb2JqZWN0LlxuXHQgKiBJZiB0aGUgdW5pZm9ybSBpcyBub3QgZm91bmQsIHRoaXMgbWV0aG9kIHJldHVybnMgbnVsbC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0QXR0cmlidXRlTG9jYXRpb25cblx0ICogQHBhcmFtICB7U3RyaW5nfSBuYW1lIHRoZSB1bmlmb3JtIG5hbWUgYXMgZGVmaW5lZCBpbiBHTFNMXG5cdCAqIEByZXR1cm4ge0dMaW50fSB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqL1xuXHRnZXRBdHRyaWJ1dGVMb2NhdGlvbjogZnVuY3Rpb24obmFtZSkgeyAvL1RPRE86IG1ha2UgZmFzdGVyLCBkb24ndCBjYWNoZVxuXHRcdHZhciBpbmZvID0gdGhpcy5nZXRBdHRyaWJ1dGVJbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGNhY2hlZCB1bmlmb3JtIGxvY2F0aW9uIG9iamVjdCwgYXNzdW1pbmcgaXQgZXhpc3RzXG5cdCAqIGFuZCBpcyBhY3RpdmUuIE5vdGUgdGhhdCB1bmlmb3JtcyBtYXkgYmUgaW5hY3RpdmUgaWYgXG5cdCAqIHRoZSBHTFNMIGNvbXBpbGVyIGRlZW1lZCB0aGVtIHVudXNlZC5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUxvY2F0aW9uXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHtXZWJHTFVuaWZvcm1Mb2NhdGlvbn0gdGhlIGxvY2F0aW9uIG9iamVjdFxuXHQgKi9cblx0Z2V0VW5pZm9ybUxvY2F0aW9uOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0dmFyIGluZm8gPSB0aGlzLmdldFVuaWZvcm1JbmZvKG5hbWUpO1xuXHRcdHJldHVybiBpbmZvID8gaW5mby5sb2NhdGlvbiA6IG51bGw7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgdW5pZm9ybSBpcyBhY3RpdmUgYW5kIGZvdW5kIGluIHRoaXNcblx0ICogY29tcGlsZWQgcHJvZ3JhbS4gTm90ZSB0aGF0IHVuaWZvcm1zIG1heSBiZSBpbmFjdGl2ZSBpZiBcblx0ICogdGhlIEdMU0wgY29tcGlsZXIgZGVlbWVkIHRoZW0gdW51c2VkLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBoYXNVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gIG5hbWUgdGhlIHVuaWZvcm0gbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSB1bmlmb3JtIGlzIGZvdW5kIGFuZCBhY3RpdmVcblx0ICovXG5cdGhhc1VuaWZvcm06IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVbmlmb3JtSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgYWN0aXZlIGFuZCBmb3VuZCBpbiB0aGlzXG5cdCAqIGNvbXBpbGVkIHByb2dyYW0uXG5cdCAqXG5cdCAqIEBtZXRob2QgIGhhc0F0dHJpYnV0ZVxuXHQgKiBAcGFyYW0gIHtTdHJpbmd9ICBuYW1lIHRoZSBhdHRyaWJ1dGUgbmFtZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSB0cnVlIGlmIHRoZSBhdHRyaWJ1dGUgaXMgZm91bmQgYW5kIGFjdGl2ZVxuXHQgKi9cblx0aGFzQXR0cmlidXRlOiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlSW5mbyhuYW1lKSAhPT0gbnVsbDtcblx0fSxcblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgdW5pZm9ybSB2YWx1ZSBieSBuYW1lLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBnZXRVbmlmb3JtXG5cdCAqIEBwYXJhbSAge1N0cmluZ30gbmFtZSB0aGUgdW5pZm9ybSBuYW1lIGFzIGRlZmluZWQgaW4gR0xTTFxuXHQgKiBAcmV0dXJuIHthbnl9IFRoZSB2YWx1ZSBvZiB0aGUgV2ViR0wgdW5pZm9ybVxuXHQgKi9cblx0Z2V0VW5pZm9ybTogZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiB0aGlzLmdsLmdldFVuaWZvcm0odGhpcy5wcm9ncmFtLCB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKSk7XG5cdH0sXG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIHVuaWZvcm0gdmFsdWUgYXQgdGhlIHNwZWNpZmllZCBXZWJHTFVuaWZvcm1Mb2NhdGlvbi5cblx0ICpcblx0ICogQG1ldGhvZCAgZ2V0VW5pZm9ybUF0XG5cdCAqIEBwYXJhbSAge1dlYkdMVW5pZm9ybUxvY2F0aW9ufSBsb2NhdGlvbiB0aGUgbG9jYXRpb24gb2JqZWN0XG5cdCAqIEByZXR1cm4ge2FueX0gVGhlIHZhbHVlIG9mIHRoZSBXZWJHTCB1bmlmb3JtXG5cdCAqL1xuXHRnZXRVbmlmb3JtQXQ6IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2wuZ2V0VW5pZm9ybSh0aGlzLnByb2dyYW0sIGxvY2F0aW9uKTtcblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1pIGZyb20gdGhlIGdpdmVuIGFyZ3VtZW50cy5cblx0ICogV2UgZGV0ZXJtaW5lIHdoaWNoIEdMIGNhbGwgdG8gbWFrZSBiYXNlZCBvbiB0aGUgbnVtYmVyIG9mIGFyZ3VtZW50c1xuXHQgKiBwYXNzZWQuIEZvciBleGFtcGxlLCBgc2V0VW5pZm9ybWkoXCJ2YXJcIiwgMCwgMSlgIG1hcHMgdG8gYGdsLnVuaWZvcm0yaWAuXG5cdCAqIFxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSAgICAgICAgXHRcdHRoZSBuYW1lIG9mIHRoZSB1bmlmb3JtXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHggIHRoZSB4IGNvbXBvbmVudCBmb3IgaW50c1xuXHQgKiBAcGFyYW0ge0dMaW50fSB5ICB0aGUgeSBjb21wb25lbnQgZm9yIGl2ZWMyXG5cdCAqIEBwYXJhbSB7R0xpbnR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgaXZlYzNcblx0ICogQHBhcmFtIHtHTGludH0gdyAgdGhlIHcgY29tcG9uZW50IGZvciBpdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWk6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xaShsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJpKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2kobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00aShsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWlcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8qKlxuXHQgKiBBIGNvbnZlbmllbmNlIG1ldGhvZCB0byBzZXQgdW5pZm9ybWYgZnJvbSB0aGUgZ2l2ZW4gYXJndW1lbnRzLlxuXHQgKiBXZSBkZXRlcm1pbmUgd2hpY2ggR0wgY2FsbCB0byBtYWtlIGJhc2VkIG9uIHRoZSBudW1iZXIgb2YgYXJndW1lbnRzXG5cdCAqIHBhc3NlZC4gRm9yIGV4YW1wbGUsIGBzZXRVbmlmb3JtZihcInZhclwiLCAwLCAxKWAgbWFwcyB0byBgZ2wudW5pZm9ybTJmYC5cblx0ICogXG5cdCAqIEBtZXRob2QgIHNldFVuaWZvcm1mXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lICAgICAgICBcdFx0dGhlIG5hbWUgb2YgdGhlIHVuaWZvcm1cblx0ICogQHBhcmFtIHtHTGZsb2F0fSB4ICB0aGUgeCBjb21wb25lbnQgZm9yIGZsb2F0c1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHkgIHRoZSB5IGNvbXBvbmVudCBmb3IgdmVjMlxuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHogIHRoZSB6IGNvbXBvbmVudCBmb3IgdmVjM1xuXHQgKiBAcGFyYW0ge0dMZmxvYXR9IHcgIHRoZSB3IGNvbXBvbmVudCBmb3IgdmVjNFxuXHQgKi9cblx0c2V0VW5pZm9ybWY6IGZ1bmN0aW9uKG5hbWUsIHgsIHksIHosIHcpIHtcblx0XHR2YXIgZ2wgPSB0aGlzLmdsO1xuXHRcdHZhciBsb2MgPSB0aGlzLmdldFVuaWZvcm1Mb2NhdGlvbihuYW1lKTtcblx0XHRpZiAoIWxvYykgXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0xZihsb2MsIHgpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTJmKGxvYywgeCwgeSk7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSA0OiBnbC51bmlmb3JtM2YobG9jLCB4LCB5LCB6KTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDU6IGdsLnVuaWZvcm00Zihsb2MsIHgsIHksIHosIHcpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRocm93IFwiaW52YWxpZCBhcmd1bWVudHMgdG8gc2V0VW5pZm9ybWZcIjsgXG5cdFx0fVxuXHR9LFxuXG5cdC8vSSBndWVzcyB3ZSB3b24ndCBzdXBwb3J0IHNlcXVlbmNlPEdMZmxvYXQ+IC4uIHdoYXRldmVyIHRoYXQgaXMgPz9cblx0XG5cblx0Ly8vLy8gXG5cdFxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OZnYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBGbG9hdDMyQXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtZnZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIHZlYzJcblx0ICovXG5cdHNldFVuaWZvcm1mdjogZnVuY3Rpb24obmFtZSwgYXJyYXlCdWZmZXIsIGNvdW50KSB7XG5cdFx0Y291bnQgPSBjb3VudCB8fCBhcnJheUJ1ZmZlci5sZW5ndGg7XG5cdFx0dmFyIGdsID0gdGhpcy5nbDtcblx0XHR2YXIgbG9jID0gdGhpcy5nZXRVbmlmb3JtTG9jYXRpb24obmFtZSk7XG5cdFx0aWYgKCFsb2MpIFxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdHN3aXRjaCAoY291bnQpIHtcblx0XHRcdGNhc2UgMTogZ2wudW5pZm9ybTFmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDI6IGdsLnVuaWZvcm0yZnYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAzOiBnbC51bmlmb3JtM2Z2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgNDogZ2wudW5pZm9ybTRmdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aHJvdyBcImludmFsaWQgYXJndW1lbnRzIHRvIHNldFVuaWZvcm1mXCI7IFxuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogQSBjb252ZW5pZW5jZSBtZXRob2QgdG8gc2V0IHVuaWZvcm1OaXYgZnJvbSB0aGUgZ2l2ZW4gQXJyYXlCdWZmZXIuXG5cdCAqIFdlIGRldGVybWluZSB3aGljaCBHTCBjYWxsIHRvIG1ha2UgYmFzZWQgb24gdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgXG5cdCAqIGJ1ZmZlciAoZm9yIDEtNCBjb21wb25lbnQgdmVjdG9ycyBzdG9yZWQgaW4gYSBpbnQgYXJyYXkpLiBUbyB1c2Vcblx0ICogdGhpcyBtZXRob2QgdG8gdXBsb2FkIGRhdGEgdG8gdW5pZm9ybSBhcnJheXMsIHlvdSBuZWVkIHRvIHNwZWNpZnkgdGhlXG5cdCAqICdjb3VudCcgcGFyYW1ldGVyOyBpLmUuIHRoZSBkYXRhIHR5cGUgeW91IGFyZSB1c2luZyBmb3IgdGhhdCBhcnJheS4gSWZcblx0ICogc3BlY2lmaWVkLCB0aGlzIHdpbGwgZGljdGF0ZSB3aGV0aGVyIHRvIGNhbGwgdW5pZm9ybTFmdiwgdW5pZm9ybTJmdiwgZXRjLlxuXHQgKlxuXHQgKiBAbWV0aG9kICBzZXRVbmlmb3JtaXZcblx0ICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgICAgICAgIFx0XHR0aGUgbmFtZSBvZiB0aGUgdW5pZm9ybVxuXHQgKiBAcGFyYW0ge0FycmF5QnVmZmVyfSBhcnJheUJ1ZmZlciB0aGUgYXJyYXkgYnVmZmVyXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudCAgICAgICAgICAgIG9wdGlvbmFsLCB0aGUgZXhwbGljaXQgZGF0YSB0eXBlIGNvdW50LCBlLmcuIDIgZm9yIGl2ZWMyXG5cdCAqL1xuXHRzZXRVbmlmb3JtaXY6IGZ1bmN0aW9uKG5hbWUsIGFycmF5QnVmZmVyLCBjb3VudCkge1xuXHRcdGNvdW50ID0gY291bnQgfHwgYXJyYXlCdWZmZXIubGVuZ3RoO1xuXHRcdHZhciBnbCA9IHRoaXMuZ2w7XG5cdFx0dmFyIGxvYyA9IHRoaXMuZ2V0VW5pZm9ybUxvY2F0aW9uKG5hbWUpO1xuXHRcdGlmICghbG9jKSBcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRzd2l0Y2ggKGNvdW50KSB7XG5cdFx0XHRjYXNlIDE6IGdsLnVuaWZvcm0xaXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSAyOiBnbC51bmlmb3JtMml2KGxvYywgYXJyYXlCdWZmZXIpOyByZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgMzogZ2wudW5pZm9ybTNpdihsb2MsIGFycmF5QnVmZmVyKTsgcmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIDQ6IGdsLnVuaWZvcm00aXYobG9jLCBhcnJheUJ1ZmZlcik7IHJldHVybiB0cnVlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhyb3cgXCJpbnZhbGlkIGFyZ3VtZW50cyB0byBzZXRVbmlmb3JtZlwiOyBcblx0XHR9XG5cdH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNoYWRlclByb2dyYW07IiwiLyoqXG4gIEF1dG8tZ2VuZXJhdGVkIEthbWkgaW5kZXggZmlsZS5cbiAgQ3JlYXRlZCBvbiAyMDEzLTEyLTIzLlxuKi9cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIC8vY29yZSBjbGFzc2VzXG4gICAgJ0Jhc2VCYXRjaCc6ICAgICAgIHJlcXVpcmUoJy4vQmFzZUJhdGNoLmpzJyksXG4gICAgJ1Nwcml0ZUJhdGNoJzogICAgIHJlcXVpcmUoJy4vU3ByaXRlQmF0Y2guanMnKSxcbiAgICAnVGV4dHVyZSc6ICAgICAgICAgcmVxdWlyZSgnLi9UZXh0dXJlLmpzJyksXG4gICAgJ1RleHR1cmVSZWdpb24nOiAgIHJlcXVpcmUoJy4vVGV4dHVyZVJlZ2lvbi5qcycpLFxuICAgICdXZWJHTENvbnRleHQnOiAgICByZXF1aXJlKCcuL1dlYkdMQ29udGV4dC5qcycpLFxuICAgICdGcmFtZUJ1ZmZlcic6ICAgICByZXF1aXJlKCcuL2dsdXRpbHMvRnJhbWVCdWZmZXIuanMnKSxcbiAgICAnTWVzaCc6ICAgICAgICAgICAgcmVxdWlyZSgnLi9nbHV0aWxzL01lc2guanMnKSxcbiAgICAnU2hhZGVyUHJvZ3JhbSc6ICAgcmVxdWlyZSgnLi9nbHV0aWxzL1NoYWRlclByb2dyYW0uanMnKVxufTsiLCJmdW5jdGlvbiBoYXNHZXR0ZXJPclNldHRlcihkZWYpIHtcblx0cmV0dXJuICghIWRlZi5nZXQgJiYgdHlwZW9mIGRlZi5nZXQgPT09IFwiZnVuY3Rpb25cIikgfHwgKCEhZGVmLnNldCAmJiB0eXBlb2YgZGVmLnNldCA9PT0gXCJmdW5jdGlvblwiKTtcbn1cblxuZnVuY3Rpb24gZ2V0UHJvcGVydHkoZGVmaW5pdGlvbiwgaywgaXNDbGFzc0Rlc2NyaXB0b3IpIHtcblx0Ly9UaGlzIG1heSBiZSBhIGxpZ2h0d2VpZ2h0IG9iamVjdCwgT1IgaXQgbWlnaHQgYmUgYSBwcm9wZXJ0eVxuXHQvL3RoYXQgd2FzIGRlZmluZWQgcHJldmlvdXNseS5cblx0XG5cdC8vRm9yIHNpbXBsZSBjbGFzcyBkZXNjcmlwdG9ycyB3ZSBjYW4ganVzdCBhc3N1bWUgaXRzIE5PVCBwcmV2aW91c2x5IGRlZmluZWQuXG5cdHZhciBkZWYgPSBpc0NsYXNzRGVzY3JpcHRvciBcblx0XHRcdFx0PyBkZWZpbml0aW9uW2tdIFxuXHRcdFx0XHQ6IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoZGVmaW5pdGlvbiwgayk7XG5cblx0aWYgKCFpc0NsYXNzRGVzY3JpcHRvciAmJiBkZWYudmFsdWUgJiYgdHlwZW9mIGRlZi52YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuXHRcdGRlZiA9IGRlZi52YWx1ZTtcblx0fVxuXG5cblx0Ly9UaGlzIG1pZ2h0IGJlIGEgcmVndWxhciBwcm9wZXJ0eSwgb3IgaXQgbWF5IGJlIGEgZ2V0dGVyL3NldHRlciB0aGUgdXNlciBkZWZpbmVkIGluIGEgY2xhc3MuXG5cdGlmICggZGVmICYmIGhhc0dldHRlck9yU2V0dGVyKGRlZikgKSB7XG5cdFx0aWYgKHR5cGVvZiBkZWYuZW51bWVyYWJsZSA9PT0gXCJ1bmRlZmluZWRcIilcblx0XHRcdGRlZi5lbnVtZXJhYmxlID0gdHJ1ZTtcblx0XHRpZiAodHlwZW9mIGRlZi5jb25maWd1cmFibGUgPT09IFwidW5kZWZpbmVkXCIpXG5cdFx0XHRkZWYuY29uZmlndXJhYmxlID0gdHJ1ZTtcblx0XHRyZXR1cm4gZGVmO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxufVxuXG5mdW5jdGlvbiBoYXNOb25Db25maWd1cmFibGUob2JqLCBrKSB7XG5cdHZhciBwcm9wID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmosIGspO1xuXHRpZiAoIXByb3ApXG5cdFx0cmV0dXJuIGZhbHNlO1xuXG5cdGlmIChwcm9wLnZhbHVlICYmIHR5cGVvZiBwcm9wLnZhbHVlID09PSBcIm9iamVjdFwiKVxuXHRcdHByb3AgPSBwcm9wLnZhbHVlO1xuXG5cdGlmIChwcm9wLmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIFxuXHRcdHJldHVybiB0cnVlO1xuXG5cdHJldHVybiBmYWxzZTtcbn1cblxuLy9UT0RPOiBPbiBjcmVhdGUsIFxuLy9cdFx0T24gbWl4aW4sIFxuXG5mdW5jdGlvbiBleHRlbmQoY3RvciwgZGVmaW5pdGlvbiwgaXNDbGFzc0Rlc2NyaXB0b3IsIGV4dGVuZCkge1xuXHRmb3IgKHZhciBrIGluIGRlZmluaXRpb24pIHtcblx0XHRpZiAoIWRlZmluaXRpb24uaGFzT3duUHJvcGVydHkoaykpXG5cdFx0XHRjb250aW51ZTtcblxuXHRcdHZhciBkZWYgPSBnZXRQcm9wZXJ0eShkZWZpbml0aW9uLCBrLCBpc0NsYXNzRGVzY3JpcHRvcik7XG5cblx0XHRpZiAoZGVmICE9PSBmYWxzZSkge1xuXHRcdFx0Ly9JZiBFeHRlbmRzIGlzIHVzZWQsIHdlIHdpbGwgY2hlY2sgaXRzIHByb3RvdHlwZSB0byBzZWUgaWYgXG5cdFx0XHQvL3RoZSBmaW5hbCB2YXJpYWJsZSBleGlzdHMuXG5cdFx0XHRcblx0XHRcdHZhciBwYXJlbnQgPSBleHRlbmQgfHwgY3Rvcjtcblx0XHRcdGlmIChoYXNOb25Db25maWd1cmFibGUocGFyZW50LnByb3RvdHlwZSwgaykpIHtcblxuXHRcdFx0XHQvL2p1c3Qgc2tpcCB0aGUgZmluYWwgcHJvcGVydHlcblx0XHRcdFx0aWYgKENsYXNzLmlnbm9yZUZpbmFscylcblx0XHRcdFx0XHRjb250aW51ZTtcblxuXHRcdFx0XHQvL1dlIGNhbm5vdCByZS1kZWZpbmUgYSBwcm9wZXJ0eSB0aGF0IGlzIGNvbmZpZ3VyYWJsZT1mYWxzZS5cblx0XHRcdFx0Ly9TbyB3ZSB3aWxsIGNvbnNpZGVyIHRoZW0gZmluYWwgYW5kIHRocm93IGFuIGVycm9yLiBUaGlzIGlzIGJ5XG5cdFx0XHRcdC8vZGVmYXVsdCBzbyBpdCBpcyBjbGVhciB0byB0aGUgZGV2ZWxvcGVyIHdoYXQgaXMgaGFwcGVuaW5nLlxuXHRcdFx0XHQvL1lvdSBjYW4gc2V0IGlnbm9yZUZpbmFscyB0byB0cnVlIGlmIHlvdSBuZWVkIHRvIGV4dGVuZCBhIGNsYXNzXG5cdFx0XHRcdC8vd2hpY2ggaGFzIGNvbmZpZ3VyYWJsZT1mYWxzZTsgaXQgd2lsbCBzaW1wbHkgbm90IHJlLWRlZmluZSBmaW5hbCBwcm9wZXJ0aWVzLlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3Qgb3ZlcnJpZGUgZmluYWwgcHJvcGVydHkgJ1wiK2tcblx0XHRcdFx0XHRcdFx0K1wiJywgc2V0IENsYXNzLmlnbm9yZUZpbmFscyA9IHRydWUgdG8gc2tpcFwiKTtcblx0XHRcdH1cblxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGN0b3IucHJvdG90eXBlLCBrLCBkZWYpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdG9yLnByb3RvdHlwZVtrXSA9IGRlZmluaXRpb25ba107XG5cdFx0fVxuXG5cdH1cbn1cblxuLyoqXG4gKi9cbmZ1bmN0aW9uIG1peGluKG15Q2xhc3MsIG1peGlucykge1xuXHRpZiAoIW1peGlucylcblx0XHRyZXR1cm47XG5cblx0aWYgKCFBcnJheS5pc0FycmF5KG1peGlucykpXG5cdFx0bWl4aW5zID0gW21peGluc107XG5cblx0Zm9yICh2YXIgaT0wOyBpPG1peGlucy5sZW5ndGg7IGkrKykge1xuXHRcdGV4dGVuZChteUNsYXNzLCBtaXhpbnNbaV0ucHJvdG90eXBlIHx8IG1peGluc1tpXSk7XG5cdH1cbn1cblxuLyoqXG4gKiBcbiAqL1xuZnVuY3Rpb24gQ2xhc3MoZGVmaW5pdGlvbikge1xuXHRpZiAoIWRlZmluaXRpb24pXG5cdFx0ZGVmaW5pdGlvbiA9IHt9O1xuXG5cdC8vVGhlIHZhcmlhYmxlIG5hbWUgaGVyZSBkaWN0YXRlcyB3aGF0IHdlIHNlZSBpbiBDaHJvbWUgZGVidWdnZXJcblx0dmFyIGluaXRpYWxpemU7XG5cdHZhciBFeHRlbmRzO1xuXG5cdGlmIChkZWZpbml0aW9uLmluaXRpYWxpemUpIHtcblx0XHRpZiAodHlwZW9mIGRlZmluaXRpb24uaW5pdGlhbGl6ZSAhPT0gXCJmdW5jdGlvblwiKVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaW5pdGlhbGl6ZSBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG5cdFx0aW5pdGlhbGl6ZSA9IGRlZmluaXRpb24uaW5pdGlhbGl6ZTtcblxuXHRcdC8vVXN1YWxseSB3ZSBzaG91bGQgYXZvaWQgXCJkZWxldGVcIiBpbiBWOCBhdCBhbGwgY29zdHMuXG5cdFx0Ly9Ib3dldmVyLCBpdHMgdW5saWtlbHkgdG8gbWFrZSBhbnkgcGVyZm9ybWFuY2UgZGlmZmVyZW5jZVxuXHRcdC8vaGVyZSBzaW5jZSB3ZSBvbmx5IGNhbGwgdGhpcyBvbiBjbGFzcyBjcmVhdGlvbiAoaS5lLiBub3Qgb2JqZWN0IGNyZWF0aW9uKS5cblx0XHRkZWxldGUgZGVmaW5pdGlvbi5pbml0aWFsaXplO1xuXHR9IGVsc2Uge1xuXHRcdGlmIChkZWZpbml0aW9uLkV4dGVuZHMpIHtcblx0XHRcdHZhciBiYXNlID0gZGVmaW5pdGlvbi5FeHRlbmRzO1xuXHRcdFx0aW5pdGlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YmFzZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXHRcdFx0fTsgXG5cdFx0fSBlbHNlIHtcblx0XHRcdGluaXRpYWxpemUgPSBmdW5jdGlvbiAoKSB7fTsgXG5cdFx0fVxuXHR9XG5cblx0aWYgKGRlZmluaXRpb24uRXh0ZW5kcykge1xuXHRcdGluaXRpYWxpemUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShkZWZpbml0aW9uLkV4dGVuZHMucHJvdG90eXBlKTtcblx0XHRpbml0aWFsaXplLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGluaXRpYWxpemU7XG5cdFx0Ly9mb3IgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIHRvIHdvcmssIHdlIG5lZWQgdG8gYWN0XG5cdFx0Ly9kaXJlY3RseSBvbiB0aGUgRXh0ZW5kcyAob3IgTWl4aW4pXG5cdFx0RXh0ZW5kcyA9IGRlZmluaXRpb24uRXh0ZW5kcztcblx0XHRkZWxldGUgZGVmaW5pdGlvbi5FeHRlbmRzO1xuXHR9IGVsc2Uge1xuXHRcdGluaXRpYWxpemUucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gaW5pdGlhbGl6ZTtcblx0fVxuXG5cdC8vR3JhYiB0aGUgbWl4aW5zLCBpZiB0aGV5IGFyZSBzcGVjaWZpZWQuLi5cblx0dmFyIG1peGlucyA9IG51bGw7XG5cdGlmIChkZWZpbml0aW9uLk1peGlucykge1xuXHRcdG1peGlucyA9IGRlZmluaXRpb24uTWl4aW5zO1xuXHRcdGRlbGV0ZSBkZWZpbml0aW9uLk1peGlucztcblx0fVxuXG5cdC8vRmlyc3QsIG1peGluIGlmIHdlIGNhbi5cblx0bWl4aW4oaW5pdGlhbGl6ZSwgbWl4aW5zKTtcblxuXHQvL05vdyB3ZSBncmFiIHRoZSBhY3R1YWwgZGVmaW5pdGlvbiB3aGljaCBkZWZpbmVzIHRoZSBvdmVycmlkZXMuXG5cdGV4dGVuZChpbml0aWFsaXplLCBkZWZpbml0aW9uLCB0cnVlLCBFeHRlbmRzKTtcblxuXHRyZXR1cm4gaW5pdGlhbGl6ZTtcbn07XG5cbkNsYXNzLmV4dGVuZCA9IGV4dGVuZDtcbkNsYXNzLm1peGluID0gbWl4aW47XG5DbGFzcy5pZ25vcmVGaW5hbHMgPSBmYWxzZTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbGFzczsiLCJ2YXIgaW50OCA9IG5ldyBJbnQ4QXJyYXkoNCk7XG52YXIgaW50MzIgPSBuZXcgSW50MzJBcnJheShpbnQ4LmJ1ZmZlciwgMCwgMSk7XG52YXIgZmxvYXQzMiA9IG5ldyBGbG9hdDMyQXJyYXkoaW50OC5idWZmZXIsIDAsIDEpO1xuXG4vKipcbiAqIEEgc2luZ2xldG9uIGZvciBudW1iZXIgdXRpbGl0aWVzLiBcbiAqIEBjbGFzcyBOdW1iZXJVdGlsXG4gKi9cbnZhciBOdW1iZXJVdGlsID0gZnVuY3Rpb24oKSB7XG5cbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgZmxvYXQgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIGludCBiaXRzLiBBcnJheUJ1ZmZlclxuICogaXMgdXNlZCBmb3IgdGhlIGNvbnZlcnNpb24uXG4gKlxuICogQG1ldGhvZCAgaW50Qml0c1RvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSAge051bWJlcn0gaSB0aGUgaW50IHRvIGNhc3RcbiAqIEByZXR1cm4ge051bWJlcn0gICB0aGUgZmxvYXRcbiAqL1xuTnVtYmVyVXRpbC5pbnRCaXRzVG9GbG9hdCA9IGZ1bmN0aW9uKGkpIHtcblx0aW50MzJbMF0gPSBpO1xuXHRyZXR1cm4gZmxvYXQzMlswXTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0aGUgaW50IGJpdHMgZnJvbSB0aGUgZ2l2ZW4gZmxvYXQuIEFycmF5QnVmZmVyIGlzIHVzZWRcbiAqIGZvciB0aGUgY29udmVyc2lvbi5cbiAqXG4gKiBAbWV0aG9kICBmbG9hdFRvSW50Qml0c1xuICogQHN0YXRpY1xuICogQHBhcmFtICB7TnVtYmVyfSBmIHRoZSBmbG9hdCB0byBjYXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIGludCBiaXRzXG4gKi9cbk51bWJlclV0aWwuZmxvYXRUb0ludEJpdHMgPSBmdW5jdGlvbihmKSB7XG5cdGZsb2F0MzJbMF0gPSBmO1xuXHRyZXR1cm4gaW50MzJbMF07XG59O1xuXG4vKipcbiAqIEVuY29kZXMgQUJHUiBpbnQgYXMgYSBmbG9hdCwgd2l0aCBzbGlnaHQgcHJlY2lzaW9uIGxvc3MuXG4gKlxuICogQG1ldGhvZCAgaW50VG9GbG9hdENvbG9yXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge051bWJlcn0gdmFsdWUgYW4gQUJHUiBwYWNrZWQgaW50ZWdlclxuICovXG5OdW1iZXJVdGlsLmludFRvRmxvYXRDb2xvciA9IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdHJldHVybiBOdW1iZXJVdGlsLmludEJpdHNUb0Zsb2F0KCB2YWx1ZSAmIDB4ZmVmZmZmZmYgKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGZsb2F0IGVuY29kZWQgQUJHUiB2YWx1ZSBmcm9tIHRoZSBnaXZlbiBSR0JBXG4gKiBieXRlcyAoMCAtIDI1NSkuIFVzZWZ1bCBmb3Igc2F2aW5nIGJhbmR3aWR0aCBpbiB2ZXJ0ZXggZGF0YS5cbiAqXG4gKiBAbWV0aG9kICBjb2xvclRvRmxvYXRcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TnVtYmVyfSByIHRoZSBSZWQgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBnIHRoZSBHcmVlbiBieXRlICgwIC0gMjU1KVxuICogQHBhcmFtIHtOdW1iZXJ9IGIgdGhlIEJsdWUgYnl0ZSAoMCAtIDI1NSlcbiAqIEBwYXJhbSB7TnVtYmVyfSBhIHRoZSBBbHBoYSBieXRlICgwIC0gMjU1KVxuICogQHJldHVybiB7RmxvYXQzMn0gIGEgRmxvYXQzMiBvZiB0aGUgUkdCQSBjb2xvclxuICovXG5OdW1iZXJVdGlsLmNvbG9yVG9GbG9hdCA9IGZ1bmN0aW9uKHIsIGcsIGIsIGEpIHtcblx0dmFyIGJpdHMgPSAoYSA8PCAyNCB8IGIgPDwgMTYgfCBnIDw8IDggfCByKTtcblx0cmV0dXJuIE51bWJlclV0aWwuaW50VG9GbG9hdENvbG9yKGJpdHMpO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIG51bWJlciBpcyBhIHBvd2VyLW9mLXR3by5cbiAqXG4gKiBAbWV0aG9kICBpc1Bvd2VyT2ZUd29cbiAqIEBwYXJhbSAge051bWJlcn0gIG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtCb29sZWFufSAgIHRydWUgaWYgcG93ZXItb2YtdHdvXG4gKi9cbk51bWJlclV0aWwuaXNQb3dlck9mVHdvID0gZnVuY3Rpb24obikge1xuXHRyZXR1cm4gKG4gJiAobiAtIDEpKSA9PSAwO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXItb2YtdHdvIGZyb20gdGhlIHNwZWNpZmllZCBudW1iZXIuIFxuICogXG4gKiBAcGFyYW0gIHtOdW1iZXJ9IG4gdGhlIG51bWJlciB0byB0ZXN0XG4gKiBAcmV0dXJuIHtOdW1iZXJ9ICAgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiB0d29cbiAqL1xuTnVtYmVyVXRpbC5uZXh0UG93ZXJPZlR3byA9IGZ1bmN0aW9uKG4pIHtcblx0bi0tO1xuXHRuIHw9IG4gPj4gMTtcblx0biB8PSBuID4+IDI7XG5cdG4gfD0gbiA+PiA0O1xuXHRuIHw9IG4gPj4gODtcblx0biB8PSBuID4+IDE2O1xuXHRyZXR1cm4gbisxO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBOdW1iZXJVdGlsOyIsIi8qanNsaW50IG9uZXZhcjp0cnVlLCB1bmRlZjp0cnVlLCBuZXdjYXA6dHJ1ZSwgcmVnZXhwOnRydWUsIGJpdHdpc2U6dHJ1ZSwgbWF4ZXJyOjUwLCBpbmRlbnQ6NCwgd2hpdGU6ZmFsc2UsIG5vbWVuOmZhbHNlLCBwbHVzcGx1czpmYWxzZSAqL1xuLypnbG9iYWwgZGVmaW5lOmZhbHNlLCByZXF1aXJlOmZhbHNlLCBleHBvcnRzOmZhbHNlLCBtb2R1bGU6ZmFsc2UsIHNpZ25hbHM6ZmFsc2UgKi9cblxuLyoqIEBsaWNlbnNlXG4gKiBKUyBTaWduYWxzIDxodHRwOi8vbWlsbGVybWVkZWlyb3MuZ2l0aHViLmNvbS9qcy1zaWduYWxzLz5cbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZVxuICogQXV0aG9yOiBNaWxsZXIgTWVkZWlyb3NcbiAqIFZlcnNpb246IDEuMC4wIC0gQnVpbGQ6IDI2OCAoMjAxMi8xMS8yOSAwNTo0OCBQTSlcbiAqL1xuXG4oZnVuY3Rpb24oZ2xvYmFsKXtcblxuICAgIC8vIFNpZ25hbEJpbmRpbmcgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLyoqXG4gICAgICogT2JqZWN0IHRoYXQgcmVwcmVzZW50cyBhIGJpbmRpbmcgYmV0d2VlbiBhIFNpZ25hbCBhbmQgYSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICAgKiA8YnIgLz4tIDxzdHJvbmc+VGhpcyBpcyBhbiBpbnRlcm5hbCBjb25zdHJ1Y3RvciBhbmQgc2hvdWxkbid0IGJlIGNhbGxlZCBieSByZWd1bGFyIHVzZXJzLjwvc3Ryb25nPlxuICAgICAqIDxiciAvPi0gaW5zcGlyZWQgYnkgSm9hIEViZXJ0IEFTMyBTaWduYWxCaW5kaW5nIGFuZCBSb2JlcnQgUGVubmVyJ3MgU2xvdCBjbGFzc2VzLlxuICAgICAqIEBhdXRob3IgTWlsbGVyIE1lZGVpcm9zXG4gICAgICogQGNvbnN0cnVjdG9yXG4gICAgICogQGludGVybmFsXG4gICAgICogQG5hbWUgU2lnbmFsQmluZGluZ1xuICAgICAqIEBwYXJhbSB7U2lnbmFsfSBzaWduYWwgUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgSGFuZGxlciBmdW5jdGlvbiBib3VuZCB0byB0aGUgc2lnbmFsLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2xpc3RlbmVyQ29udGV4dF0gQ29udGV4dCBvbiB3aGljaCBsaXN0ZW5lciB3aWxsIGJlIGV4ZWN1dGVkIChvYmplY3QgdGhhdCBzaG91bGQgcmVwcmVzZW50IHRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIGxpc3RlbmVyIGZ1bmN0aW9uKS5cbiAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiAoZGVmYXVsdCA9IDApLlxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbEJpbmRpbmcoc2lnbmFsLCBsaXN0ZW5lciwgaXNPbmNlLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXIgZnVuY3Rpb24gYm91bmQgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xpc3RlbmVyID0gbGlzdGVuZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIGJpbmRpbmcgc2hvdWxkIGJlIGV4ZWN1dGVkIGp1c3Qgb25jZS5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faXNPbmNlID0gaXNPbmNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAbWVtYmVyT2YgU2lnbmFsQmluZGluZy5wcm90b3R5cGVcbiAgICAgICAgICogQG5hbWUgY29udGV4dFxuICAgICAgICAgKiBAdHlwZSBPYmplY3R8dW5kZWZpbmVkfG51bGxcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IGxpc3RlbmVyQ29udGV4dDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVmZXJlbmNlIHRvIFNpZ25hbCBvYmplY3QgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqIEB0eXBlIFNpZ25hbFxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2lnbmFsID0gc2lnbmFsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBMaXN0ZW5lciBwcmlvcml0eVxuICAgICAgICAgKiBAdHlwZSBOdW1iZXJcbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByaW9yaXR5ID0gcHJpb3JpdHkgfHwgMDtcbiAgICB9XG5cbiAgICBTaWduYWxCaW5kaW5nLnByb3RvdHlwZSA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSWYgYmluZGluZyBpcyBhY3RpdmUgYW5kIHNob3VsZCBiZSBleGVjdXRlZC5cbiAgICAgICAgICogQHR5cGUgYm9vbGVhblxuICAgICAgICAgKi9cbiAgICAgICAgYWN0aXZlIDogdHJ1ZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRGVmYXVsdCBwYXJhbWV0ZXJzIHBhc3NlZCB0byBsaXN0ZW5lciBkdXJpbmcgYFNpZ25hbC5kaXNwYXRjaGAgYW5kIGBTaWduYWxCaW5kaW5nLmV4ZWN1dGVgLiAoY3VycmllZCBwYXJhbWV0ZXJzKVxuICAgICAgICAgKiBAdHlwZSBBcnJheXxudWxsXG4gICAgICAgICAqL1xuICAgICAgICBwYXJhbXMgOiBudWxsLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDYWxsIGxpc3RlbmVyIHBhc3NpbmcgYXJiaXRyYXJ5IHBhcmFtZXRlcnMuXG4gICAgICAgICAqIDxwPklmIGJpbmRpbmcgd2FzIGFkZGVkIHVzaW5nIGBTaWduYWwuYWRkT25jZSgpYCBpdCB3aWxsIGJlIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZCBmcm9tIHNpZ25hbCBkaXNwYXRjaCBxdWV1ZSwgdGhpcyBtZXRob2QgaXMgdXNlZCBpbnRlcm5hbGx5IGZvciB0aGUgc2lnbmFsIGRpc3BhdGNoLjwvcD5cbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gW3BhcmFtc0Fycl0gQXJyYXkgb2YgcGFyYW1ldGVycyB0aGF0IHNob3VsZCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyXG4gICAgICAgICAqIEByZXR1cm4geyp9IFZhbHVlIHJldHVybmVkIGJ5IHRoZSBsaXN0ZW5lci5cbiAgICAgICAgICovXG4gICAgICAgIGV4ZWN1dGUgOiBmdW5jdGlvbiAocGFyYW1zQXJyKSB7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclJldHVybiwgcGFyYW1zO1xuICAgICAgICAgICAgaWYgKHRoaXMuYWN0aXZlICYmICEhdGhpcy5fbGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICBwYXJhbXMgPSB0aGlzLnBhcmFtcz8gdGhpcy5wYXJhbXMuY29uY2F0KHBhcmFtc0FycikgOiBwYXJhbXNBcnI7XG4gICAgICAgICAgICAgICAgaGFuZGxlclJldHVybiA9IHRoaXMuX2xpc3RlbmVyLmFwcGx5KHRoaXMuY29udGV4dCwgcGFyYW1zKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNPbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGhhbmRsZXJSZXR1cm47XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIERldGFjaCBiaW5kaW5nIGZyb20gc2lnbmFsLlxuICAgICAgICAgKiAtIGFsaWFzIHRvOiBteVNpZ25hbC5yZW1vdmUobXlCaW5kaW5nLmdldExpc3RlbmVyKCkpO1xuICAgICAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwgb3IgYG51bGxgIGlmIGJpbmRpbmcgd2FzIHByZXZpb3VzbHkgZGV0YWNoZWQuXG4gICAgICAgICAqL1xuICAgICAgICBkZXRhY2ggOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc0JvdW5kKCk/IHRoaXMuX3NpZ25hbC5yZW1vdmUodGhpcy5fbGlzdGVuZXIsIHRoaXMuY29udGV4dCkgOiBudWxsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcmV0dXJuIHtCb29sZWFufSBgdHJ1ZWAgaWYgYmluZGluZyBpcyBzdGlsbCBib3VuZCB0byB0aGUgc2lnbmFsIGFuZCBoYXZlIGEgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBpc0JvdW5kIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICghIXRoaXMuX3NpZ25hbCAmJiAhIXRoaXMuX2xpc3RlbmVyKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgU2lnbmFsQmluZGluZyB3aWxsIG9ubHkgYmUgZXhlY3V0ZWQgb25jZS5cbiAgICAgICAgICovXG4gICAgICAgIGlzT25jZSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pc09uY2U7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBIYW5kbGVyIGZ1bmN0aW9uIGJvdW5kIHRvIHRoZSBzaWduYWwuXG4gICAgICAgICAqL1xuICAgICAgICBnZXRMaXN0ZW5lciA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9saXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsfSBTaWduYWwgdGhhdCBsaXN0ZW5lciBpcyBjdXJyZW50bHkgYm91bmQgdG8uXG4gICAgICAgICAqL1xuICAgICAgICBnZXRTaWduYWwgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2lnbmFsO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEZWxldGUgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX2Rlc3Ryb3kgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fc2lnbmFsO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2xpc3RlbmVyO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuY29udGV4dDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHJldHVybiB7c3RyaW5nfSBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG9iamVjdC5cbiAgICAgICAgICovXG4gICAgICAgIHRvU3RyaW5nIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdbU2lnbmFsQmluZGluZyBpc09uY2U6JyArIHRoaXMuX2lzT25jZSArJywgaXNCb3VuZDonKyB0aGlzLmlzQm91bmQoKSArJywgYWN0aXZlOicgKyB0aGlzLmFjdGl2ZSArICddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4vKmdsb2JhbCBTaWduYWxCaW5kaW5nOmZhbHNlKi9cblxuICAgIC8vIFNpZ25hbCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgZnVuY3Rpb24gdmFsaWRhdGVMaXN0ZW5lcihsaXN0ZW5lciwgZm5OYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbGlzdGVuZXIgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvciggJ2xpc3RlbmVyIGlzIGEgcmVxdWlyZWQgcGFyYW0gb2Yge2ZufSgpIGFuZCBzaG91bGQgYmUgYSBGdW5jdGlvbi4nLnJlcGxhY2UoJ3tmbn0nLCBmbk5hbWUpICk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiA8YnIgLz4tIGluc3BpcmVkIGJ5IFJvYmVydCBQZW5uZXIncyBBUzMgU2lnbmFscy5cbiAgICAgKiBAbmFtZSBTaWduYWxcbiAgICAgKiBAYXV0aG9yIE1pbGxlciBNZWRlaXJvc1xuICAgICAqIEBjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGZ1bmN0aW9uIFNpZ25hbCgpIHtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIEFycmF5LjxTaWduYWxCaW5kaW5nPlxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmluZGluZ3MgPSBbXTtcbiAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG5cbiAgICAgICAgLy8gZW5mb3JjZSBkaXNwYXRjaCB0byBhd2F5cyB3b3JrIG9uIHNhbWUgY29udGV4dCAoIzQ3KVxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGlzcGF0Y2ggPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgU2lnbmFsLnByb3RvdHlwZS5kaXNwYXRjaC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIFNpZ25hbC5wcm90b3R5cGUgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNpZ25hbHMgVmVyc2lvbiBOdW1iZXJcbiAgICAgICAgICogQHR5cGUgU3RyaW5nXG4gICAgICAgICAqIEBjb25zdFxuICAgICAgICAgKi9cbiAgICAgICAgVkVSU0lPTiA6ICcxLjAuMCcsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIElmIFNpZ25hbCBzaG91bGQga2VlcCByZWNvcmQgb2YgcHJldmlvdXNseSBkaXNwYXRjaGVkIHBhcmFtZXRlcnMgYW5kXG4gICAgICAgICAqIGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBsaXN0ZW5lciBkdXJpbmcgYGFkZCgpYC9gYWRkT25jZSgpYCBpZiBTaWduYWwgd2FzXG4gICAgICAgICAqIGFscmVhZHkgZGlzcGF0Y2hlZCBiZWZvcmUuXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIG1lbW9yaXplIDogZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIF9zaG91bGRQcm9wYWdhdGUgOiB0cnVlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiBTaWduYWwgaXMgYWN0aXZlIGFuZCBzaG91bGQgYnJvYWRjYXN0IGV2ZW50cy5cbiAgICAgICAgICogPHA+PHN0cm9uZz5JTVBPUlRBTlQ6PC9zdHJvbmc+IFNldHRpbmcgdGhpcyBwcm9wZXJ0eSBkdXJpbmcgYSBkaXNwYXRjaCB3aWxsIG9ubHkgYWZmZWN0IHRoZSBuZXh0IGRpc3BhdGNoLCBpZiB5b3Ugd2FudCB0byBzdG9wIHRoZSBwcm9wYWdhdGlvbiBvZiBhIHNpZ25hbCB1c2UgYGhhbHQoKWAgaW5zdGVhZC48L3A+XG4gICAgICAgICAqIEB0eXBlIGJvb2xlYW5cbiAgICAgICAgICovXG4gICAgICAgIGFjdGl2ZSA6IHRydWUsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyXG4gICAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNPbmNlXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XVxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgX3JlZ2lzdGVyTGlzdGVuZXIgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGlzT25jZSwgbGlzdGVuZXJDb250ZXh0LCBwcmlvcml0eSkge1xuXG4gICAgICAgICAgICB2YXIgcHJldkluZGV4ID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQpLFxuICAgICAgICAgICAgICAgIGJpbmRpbmc7XG5cbiAgICAgICAgICAgIGlmIChwcmV2SW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IHRoaXMuX2JpbmRpbmdzW3ByZXZJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRpbmcuaXNPbmNlKCkgIT09IGlzT25jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBjYW5ub3QgYWRkJysgKGlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlbiBhZGQnKyAoIWlzT25jZT8gJycgOiAnT25jZScpICsnKCkgdGhlIHNhbWUgbGlzdGVuZXIgd2l0aG91dCByZW1vdmluZyB0aGUgcmVsYXRpb25zaGlwIGZpcnN0LicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYmluZGluZyA9IG5ldyBTaWduYWxCaW5kaW5nKHRoaXMsIGxpc3RlbmVyLCBpc09uY2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FkZEJpbmRpbmcoYmluZGluZyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRoaXMubWVtb3JpemUgJiYgdGhpcy5fcHJldlBhcmFtcyl7XG4gICAgICAgICAgICAgICAgYmluZGluZy5leGVjdXRlKHRoaXMuX3ByZXZQYXJhbXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHBhcmFtIHtTaWduYWxCaW5kaW5nfSBiaW5kaW5nXG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfYWRkQmluZGluZyA6IGZ1bmN0aW9uIChiaW5kaW5nKSB7XG4gICAgICAgICAgICAvL3NpbXBsaWZpZWQgaW5zZXJ0aW9uIHNvcnRcbiAgICAgICAgICAgIHZhciBuID0gdGhpcy5fYmluZGluZ3MubGVuZ3RoO1xuICAgICAgICAgICAgZG8geyAtLW47IH0gd2hpbGUgKHRoaXMuX2JpbmRpbmdzW25dICYmIGJpbmRpbmcuX3ByaW9yaXR5IDw9IHRoaXMuX2JpbmRpbmdzW25dLl9wcmlvcml0eSk7XG4gICAgICAgICAgICB0aGlzLl9iaW5kaW5ncy5zcGxpY2UobiArIDEsIDAsIGJpbmRpbmcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lclxuICAgICAgICAgKiBAcmV0dXJuIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICBfaW5kZXhPZkxpc3RlbmVyIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YXIgbiA9IHRoaXMuX2JpbmRpbmdzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBjdXI7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgY3VyID0gdGhpcy5fYmluZGluZ3Nbbl07XG4gICAgICAgICAgICAgICAgaWYgKGN1ci5fbGlzdGVuZXIgPT09IGxpc3RlbmVyICYmIGN1ci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2hlY2sgaWYgbGlzdGVuZXIgd2FzIGF0dGFjaGVkIHRvIFNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XVxuICAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpZiBTaWduYWwgaGFzIHRoZSBzcGVjaWZpZWQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBoYXMgOiBmdW5jdGlvbiAobGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbmRleE9mTGlzdGVuZXIobGlzdGVuZXIsIGNvbnRleHQpICE9PSAtMTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogQWRkIGEgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbC5cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgU2lnbmFsIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbbGlzdGVuZXJDb250ZXh0XSBDb250ZXh0IG9uIHdoaWNoIGxpc3RlbmVyIHdpbGwgYmUgZXhlY3V0ZWQgKG9iamVjdCB0aGF0IHNob3VsZCByZXByZXNlbnQgdGhlIGB0aGlzYCB2YXJpYWJsZSBpbnNpZGUgbGlzdGVuZXIgZnVuY3Rpb24pLlxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gW3ByaW9yaXR5XSBUaGUgcHJpb3JpdHkgbGV2ZWwgb2YgdGhlIGV2ZW50IGxpc3RlbmVyLiBMaXN0ZW5lcnMgd2l0aCBoaWdoZXIgcHJpb3JpdHkgd2lsbCBiZSBleGVjdXRlZCBiZWZvcmUgbGlzdGVuZXJzIHdpdGggbG93ZXIgcHJpb3JpdHkuIExpc3RlbmVycyB3aXRoIHNhbWUgcHJpb3JpdHkgbGV2ZWwgd2lsbCBiZSBleGVjdXRlZCBhdCB0aGUgc2FtZSBvcmRlciBhcyB0aGV5IHdlcmUgYWRkZWQuIChkZWZhdWx0ID0gMClcbiAgICAgICAgICogQHJldHVybiB7U2lnbmFsQmluZGluZ30gQW4gT2JqZWN0IHJlcHJlc2VudGluZyB0aGUgYmluZGluZyBiZXR3ZWVuIHRoZSBTaWduYWwgYW5kIGxpc3RlbmVyLlxuICAgICAgICAgKi9cbiAgICAgICAgYWRkIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkJyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcmVnaXN0ZXJMaXN0ZW5lcihsaXN0ZW5lciwgZmFsc2UsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBZGQgbGlzdGVuZXIgdG8gdGhlIHNpZ25hbCB0aGF0IHNob3VsZCBiZSByZW1vdmVkIGFmdGVyIGZpcnN0IGV4ZWN1dGlvbiAod2lsbCBiZSBleGVjdXRlZCBvbmx5IG9uY2UpLlxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaXN0ZW5lciBTaWduYWwgaGFuZGxlciBmdW5jdGlvbi5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtsaXN0ZW5lckNvbnRleHRdIENvbnRleHQgb24gd2hpY2ggbGlzdGVuZXIgd2lsbCBiZSBleGVjdXRlZCAob2JqZWN0IHRoYXQgc2hvdWxkIHJlcHJlc2VudCB0aGUgYHRoaXNgIHZhcmlhYmxlIGluc2lkZSBsaXN0ZW5lciBmdW5jdGlvbikuXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBbcHJpb3JpdHldIFRoZSBwcmlvcml0eSBsZXZlbCBvZiB0aGUgZXZlbnQgbGlzdGVuZXIuIExpc3RlbmVycyB3aXRoIGhpZ2hlciBwcmlvcml0eSB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZSBsaXN0ZW5lcnMgd2l0aCBsb3dlciBwcmlvcml0eS4gTGlzdGVuZXJzIHdpdGggc2FtZSBwcmlvcml0eSBsZXZlbCB3aWxsIGJlIGV4ZWN1dGVkIGF0IHRoZSBzYW1lIG9yZGVyIGFzIHRoZXkgd2VyZSBhZGRlZC4gKGRlZmF1bHQgPSAwKVxuICAgICAgICAgKiBAcmV0dXJuIHtTaWduYWxCaW5kaW5nfSBBbiBPYmplY3QgcmVwcmVzZW50aW5nIHRoZSBiaW5kaW5nIGJldHdlZW4gdGhlIFNpZ25hbCBhbmQgbGlzdGVuZXIuXG4gICAgICAgICAqL1xuICAgICAgICBhZGRPbmNlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBsaXN0ZW5lckNvbnRleHQsIHByaW9yaXR5KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAnYWRkT25jZScpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXIobGlzdGVuZXIsIHRydWUsIGxpc3RlbmVyQ29udGV4dCwgcHJpb3JpdHkpO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW1vdmUgYSBzaW5nbGUgbGlzdGVuZXIgZnJvbSB0aGUgZGlzcGF0Y2ggcXVldWUuXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIEhhbmRsZXIgZnVuY3Rpb24gdGhhdCBzaG91bGQgYmUgcmVtb3ZlZC5cbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSBFeGVjdXRpb24gY29udGV4dCAoc2luY2UgeW91IGNhbiBhZGQgdGhlIHNhbWUgaGFuZGxlciBtdWx0aXBsZSB0aW1lcyBpZiBleGVjdXRpbmcgaW4gYSBkaWZmZXJlbnQgY29udGV4dCkuXG4gICAgICAgICAqIEByZXR1cm4ge0Z1bmN0aW9ufSBMaXN0ZW5lciBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlIDogZnVuY3Rpb24gKGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZUxpc3RlbmVyKGxpc3RlbmVyLCAncmVtb3ZlJyk7XG5cbiAgICAgICAgICAgIHZhciBpID0gdGhpcy5faW5kZXhPZkxpc3RlbmVyKGxpc3RlbmVyLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzW2ldLl9kZXN0cm95KCk7IC8vbm8gcmVhc29uIHRvIGEgU2lnbmFsQmluZGluZyBleGlzdCBpZiBpdCBpc24ndCBhdHRhY2hlZCB0byBhIHNpZ25hbFxuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBsaXN0ZW5lcjtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogUmVtb3ZlIGFsbCBsaXN0ZW5lcnMgZnJvbSB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgcmVtb3ZlQWxsIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdmFyIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAobi0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZGluZ3Nbbl0uX2Rlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX2JpbmRpbmdzLmxlbmd0aCA9IDA7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge251bWJlcn0gTnVtYmVyIG9mIGxpc3RlbmVycyBhdHRhY2hlZCB0byB0aGUgU2lnbmFsLlxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0TnVtTGlzdGVuZXJzIDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2JpbmRpbmdzLmxlbmd0aDtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcCBwcm9wYWdhdGlvbiBvZiB0aGUgZXZlbnQsIGJsb2NraW5nIHRoZSBkaXNwYXRjaCB0byBuZXh0IGxpc3RlbmVycyBvbiB0aGUgcXVldWUuXG4gICAgICAgICAqIDxwPjxzdHJvbmc+SU1QT1JUQU5UOjwvc3Ryb25nPiBzaG91bGQgYmUgY2FsbGVkIG9ubHkgZHVyaW5nIHNpZ25hbCBkaXNwYXRjaCwgY2FsbGluZyBpdCBiZWZvcmUvYWZ0ZXIgZGlzcGF0Y2ggd29uJ3QgYWZmZWN0IHNpZ25hbCBicm9hZGNhc3QuPC9wPlxuICAgICAgICAgKiBAc2VlIFNpZ25hbC5wcm90b3R5cGUuZGlzYWJsZVxuICAgICAgICAgKi9cbiAgICAgICAgaGFsdCA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSA9IGZhbHNlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBEaXNwYXRjaC9Ccm9hZGNhc3QgU2lnbmFsIHRvIGFsbCBsaXN0ZW5lcnMgYWRkZWQgdG8gdGhlIHF1ZXVlLlxuICAgICAgICAgKiBAcGFyYW0gey4uLip9IFtwYXJhbXNdIFBhcmFtZXRlcnMgdGhhdCBzaG91bGQgYmUgcGFzc2VkIHRvIGVhY2ggaGFuZGxlci5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3BhdGNoIDogZnVuY3Rpb24gKHBhcmFtcykge1xuICAgICAgICAgICAgaWYgKCEgdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBwYXJhbXNBcnIgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpLFxuICAgICAgICAgICAgICAgIG4gPSB0aGlzLl9iaW5kaW5ncy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYmluZGluZ3M7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm1lbW9yaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IHBhcmFtc0FycjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCEgbikge1xuICAgICAgICAgICAgICAgIC8vc2hvdWxkIGNvbWUgYWZ0ZXIgbWVtb3JpemVcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJpbmRpbmdzID0gdGhpcy5fYmluZGluZ3Muc2xpY2UoKTsgLy9jbG9uZSBhcnJheSBpbiBjYXNlIGFkZC9yZW1vdmUgaXRlbXMgZHVyaW5nIGRpc3BhdGNoXG4gICAgICAgICAgICB0aGlzLl9zaG91bGRQcm9wYWdhdGUgPSB0cnVlOyAvL2luIGNhc2UgYGhhbHRgIHdhcyBjYWxsZWQgYmVmb3JlIGRpc3BhdGNoIG9yIGR1cmluZyB0aGUgcHJldmlvdXMgZGlzcGF0Y2guXG5cbiAgICAgICAgICAgIC8vZXhlY3V0ZSBhbGwgY2FsbGJhY2tzIHVudGlsIGVuZCBvZiB0aGUgbGlzdCBvciB1bnRpbCBhIGNhbGxiYWNrIHJldHVybnMgYGZhbHNlYCBvciBzdG9wcyBwcm9wYWdhdGlvblxuICAgICAgICAgICAgLy9yZXZlcnNlIGxvb3Agc2luY2UgbGlzdGVuZXJzIHdpdGggaGlnaGVyIHByaW9yaXR5IHdpbGwgYmUgYWRkZWQgYXQgdGhlIGVuZCBvZiB0aGUgbGlzdFxuICAgICAgICAgICAgZG8geyBuLS07IH0gd2hpbGUgKGJpbmRpbmdzW25dICYmIHRoaXMuX3Nob3VsZFByb3BhZ2F0ZSAmJiBiaW5kaW5nc1tuXS5leGVjdXRlKHBhcmFtc0FycikgIT09IGZhbHNlKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yZ2V0IG1lbW9yaXplZCBhcmd1bWVudHMuXG4gICAgICAgICAqIEBzZWUgU2lnbmFsLm1lbW9yaXplXG4gICAgICAgICAqL1xuICAgICAgICBmb3JnZXQgOiBmdW5jdGlvbigpe1xuICAgICAgICAgICAgdGhpcy5fcHJldlBhcmFtcyA9IG51bGw7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFJlbW92ZSBhbGwgYmluZGluZ3MgZnJvbSBzaWduYWwgYW5kIGRlc3Ryb3kgYW55IHJlZmVyZW5jZSB0byBleHRlcm5hbCBvYmplY3RzIChkZXN0cm95IFNpZ25hbCBvYmplY3QpLlxuICAgICAgICAgKiA8cD48c3Ryb25nPklNUE9SVEFOVDo8L3N0cm9uZz4gY2FsbGluZyBhbnkgbWV0aG9kIG9uIHRoZSBzaWduYWwgaW5zdGFuY2UgYWZ0ZXIgY2FsbGluZyBkaXNwb3NlIHdpbGwgdGhyb3cgZXJyb3JzLjwvcD5cbiAgICAgICAgICovXG4gICAgICAgIGRpc3Bvc2UgOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUFsbCgpO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdzO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3ByZXZQYXJhbXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEByZXR1cm4ge3N0cmluZ30gU3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBvYmplY3QuXG4gICAgICAgICAqL1xuICAgICAgICB0b1N0cmluZyA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnW1NpZ25hbCBhY3RpdmU6JysgdGhpcy5hY3RpdmUgKycgbnVtTGlzdGVuZXJzOicrIHRoaXMuZ2V0TnVtTGlzdGVuZXJzKCkgKyddJztcbiAgICAgICAgfVxuXG4gICAgfTtcblxuXG4gICAgLy8gTmFtZXNwYWNlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLy89PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvKipcbiAgICAgKiBTaWduYWxzIG5hbWVzcGFjZVxuICAgICAqIEBuYW1lc3BhY2VcbiAgICAgKiBAbmFtZSBzaWduYWxzXG4gICAgICovXG4gICAgdmFyIHNpZ25hbHMgPSBTaWduYWw7XG5cbiAgICAvKipcbiAgICAgKiBDdXN0b20gZXZlbnQgYnJvYWRjYXN0ZXJcbiAgICAgKiBAc2VlIFNpZ25hbFxuICAgICAqL1xuICAgIC8vIGFsaWFzIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSAoc2VlICNnaC00NClcbiAgICBzaWduYWxzLlNpZ25hbCA9IFNpZ25hbDtcblxuXG5cbiAgICAvL2V4cG9ydHMgdG8gbXVsdGlwbGUgZW52aXJvbm1lbnRzXG4gICAgaWYodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKXsgLy9BTURcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHNpZ25hbHM7IH0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpeyAvL25vZGVcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBzaWduYWxzO1xuICAgIH0gZWxzZSB7IC8vYnJvd3NlclxuICAgICAgICAvL3VzZSBzdHJpbmcgYmVjYXVzZSBvZiBHb29nbGUgY2xvc3VyZSBjb21waWxlciBBRFZBTkNFRF9NT0RFXG4gICAgICAgIC8qanNsaW50IHN1Yjp0cnVlICovXG4gICAgICAgIGdsb2JhbFsnc2lnbmFscyddID0gc2lnbmFscztcbiAgICB9XG5cbn0odGhpcykpO1xuIiwiLypcbiAqIHJhZi5qc1xuICogaHR0cHM6Ly9naXRodWIuY29tL25ncnltYW4vcmFmLmpzXG4gKlxuICogb3JpZ2luYWwgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHBvbHlmaWxsIGJ5IEVyaWsgTcO2bGxlclxuICogaW5zcGlyZWQgZnJvbSBwYXVsX2lyaXNoIGdpc3QgYW5kIHBvc3RcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMgbmdyeW1hblxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICovXG5cbihmdW5jdGlvbih3aW5kb3cpIHtcblx0dmFyIGxhc3RUaW1lID0gMCxcblx0XHR2ZW5kb3JzID0gWyd3ZWJraXQnLCAnbW96J10sXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lID0gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSxcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZSxcblx0XHRpID0gdmVuZG9ycy5sZW5ndGg7XG5cblx0Ly8gdHJ5IHRvIHVuLXByZWZpeCBleGlzdGluZyByYWZcblx0d2hpbGUgKC0taSA+PSAwICYmICFyZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHtcblx0XHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSB3aW5kb3dbdmVuZG9yc1tpXSArICdSZXF1ZXN0QW5pbWF0aW9uRnJhbWUnXTtcblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IHdpbmRvd1t2ZW5kb3JzW2ldICsgJ0NhbmNlbEFuaW1hdGlvbkZyYW1lJ107XG5cdH1cblxuXHQvLyBwb2x5ZmlsbCB3aXRoIHNldFRpbWVvdXQgZmFsbGJhY2tcblx0Ly8gaGVhdmlseSBpbnNwaXJlZCBmcm9tIEBkYXJpdXMgZ2lzdCBtb2Q6IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC8xNTc5NjcxI2NvbW1lbnQtODM3OTQ1XG5cdGlmICghcmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8ICFjYW5jZWxBbmltYXRpb25GcmFtZSkge1xuXHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHR2YXIgbm93ID0gRGF0ZS5ub3coKSwgbmV4dFRpbWUgPSBNYXRoLm1heChsYXN0VGltZSArIDE2LCBub3cpO1xuXHRcdFx0cmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGNhbGxiYWNrKGxhc3RUaW1lID0gbmV4dFRpbWUpO1xuXHRcdFx0fSwgbmV4dFRpbWUgLSBub3cpO1xuXHRcdH07XG5cblx0XHRjYW5jZWxBbmltYXRpb25GcmFtZSA9IGNsZWFyVGltZW91dDtcblx0fVxuXG5cdC8vIGV4cG9ydCB0byB3aW5kb3dcblx0d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSA9IHJlcXVlc3RBbmltYXRpb25GcmFtZTtcblx0d2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lID0gY2FuY2VsQW5pbWF0aW9uRnJhbWU7XG59KHdpbmRvdykpOyIsInZhciBkb21yZWFkeSA9IHJlcXVpcmUoJ2RvbXJlYWR5Jyk7XG5cbnZhciBXZWJHTENvbnRleHQgPSByZXF1aXJlKCdrYW1pJykuV2ViR0xDb250ZXh0O1xudmFyIFRleHR1cmUgPSByZXF1aXJlKCdrYW1pJykuVGV4dHVyZTtcbnZhciBTcHJpdGVCYXRjaCA9IHJlcXVpcmUoJ2thbWknKS5TcHJpdGVCYXRjaDtcbnZhciBTaGFkZXJQcm9ncmFtID0gcmVxdWlyZSgna2FtaScpLlNoYWRlclByb2dyYW07XG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xuXG4vL2luY2x1ZGUgcG9seWZpbGwgZm9yIHJlcXVlc3RBbmltYXRpb25GcmFtZVxucmVxdWlyZSgncmFmLmpzJyk7XG5cbnZhciB2ZXJ0ID0gXCIvL2luY29taW5nIFBvc2l0aW9uIGF0dHJpYnV0ZSBmcm9tIG91ciBTcHJpdGVCYXRjaFxcbmF0dHJpYnV0ZSB2ZWMyIFBvc2l0aW9uO1xcbmF0dHJpYnV0ZSB2ZWM0IENvbG9yO1xcbmF0dHJpYnV0ZSB2ZWMyIFRleENvb3JkMDtcXG51bmlmb3JtIHZlYzIgdV9wcm9qZWN0aW9uO1xcbnZhcnlpbmcgdmVjMiB2VGV4Q29vcmQwO1xcbnZhcnlpbmcgdmVjNCB2Q29sb3I7XFxuXFxudm9pZCBtYWluKHZvaWQpIHtcXG4gICBnbF9Qb3NpdGlvbiA9IHZlYzQoIFBvc2l0aW9uLnggLyB1X3Byb2plY3Rpb24ueCAtIDEuMCwgUG9zaXRpb24ueSAvIC11X3Byb2plY3Rpb24ueSArIDEuMCAsIDAuMCwgMS4wKTtcXG4gICB2VGV4Q29vcmQwID0gVGV4Q29vcmQwO1xcbiAgIHZDb2xvciA9IENvbG9yO1xcbn1cIjtcbnZhciBmcmFnID0gXCIjaWZkZWYgR0xfRVNcXG5wcmVjaXNpb24gbWVkaXVtcCBmbG9hdDtcXG4jZW5kaWZcXG5cXG4vL2ZpeGVkIG51bWJlciBvZiBsaWdodHNcXG4jZGVmaW5lIE5fTElHSFRTIDJcXG5cXG4vL2F0dHJpYnV0ZXMgZnJvbSB2ZXJ0ZXggc2hhZGVyXFxudmFyeWluZyB2ZWM0IHZDb2xvcjtcXG52YXJ5aW5nIHZlYzIgdlRleENvb3JkMDtcXG5cXG4vL291ciB0ZXh0dXJlIHNhbXBsZXJzXFxudW5pZm9ybSBzYW1wbGVyMkQgdV90ZXh0dXJlMDsgICAvL2RpZmZ1c2UgbWFwXFxudW5pZm9ybSBzYW1wbGVyMkQgdV9ub3JtYWxzOyAgIC8vbm9ybWFsIG1hcFxcblxcbi8vdmFsdWVzIHVzZWQgZm9yIHNoYWRpbmcgYWxnb3JpdGhtLi4uXFxudW5pZm9ybSB2ZWMyIFJlc29sdXRpb247ICAgICAgLy9yZXNvbHV0aW9uIG9mIGNhbnZhc1xcbnVuaWZvcm0gdmVjNCBBbWJpZW50Q29sb3I7ICAgIC8vYW1iaWVudCBSR0JBIC0tIGFscGhhIGlzIGludGVuc2l0eSBcXG5cXG51bmlmb3JtIHZlYzMgTGlnaHRQb3NbTl9MSUdIVFNdOyAgICAgLy9saWdodCBwb3NpdGlvbiwgbm9ybWFsaXplZFxcbnVuaWZvcm0gdmVjNCBMaWdodENvbG9yW05fTElHSFRTXTsgICAvL2xpZ2h0IFJHQkEgLS0gYWxwaGEgaXMgaW50ZW5zaXR5XFxudW5pZm9ybSB2ZWMzIEZhbGxvZmZbTl9MSUdIVFNdOyAgICAgIC8vYXR0ZW51YXRpb24gY29lZmZpY2llbnRzXFxuXFxuLy8gdW5pZm9ybSBmbG9hdCBUZXN0WzJdO1xcblxcbnZvaWQgbWFpbigpIHtcXG5cXHQvL1JHQkEgb2Ygb3VyIGRpZmZ1c2UgY29sb3JcXG5cXHR2ZWM0IERpZmZ1c2VDb2xvciA9IHRleHR1cmUyRCh1X3RleHR1cmUwLCB2VGV4Q29vcmQwKTtcXG5cXHRcXG5cXHQvL1JHQiBvZiBvdXIgbm9ybWFsIG1hcFxcblxcdHZlYzMgTm9ybWFsTWFwID0gdGV4dHVyZTJEKHVfbm9ybWFscywgdlRleENvb3JkMCkucmdiO1xcblxcdFxcblxcdHZlYzMgU3VtID0gdmVjMygwLjApO1xcblxcblxcdGZvciAoaW50IGk9MDsgaTxOX0xJR0hUUzsgaSsrKSB7XFxuXFx0XFx0Ly9UaGUgZGVsdGEgcG9zaXRpb24gb2YgbGlnaHRcXG5cXHRcXHR2ZWMzIExpZ2h0RGlyID0gdmVjMyhMaWdodFBvc1tpXS54eSAtIChnbF9GcmFnQ29vcmQueHkgLyBSZXNvbHV0aW9uLnh5KSwgTGlnaHRQb3NbaV0ueik7XFxuXFx0XFx0XFxuXFx0XFx0Ly9Db3JyZWN0IGZvciBhc3BlY3QgcmF0aW9cXG5cXHRcXHRMaWdodERpci54ICo9IFJlc29sdXRpb24ueCAvIFJlc29sdXRpb24ueTtcXG5cXHRcXHRcXG5cXHRcXHQvL0RldGVybWluZSBkaXN0YW5jZSAodXNlZCBmb3IgYXR0ZW51YXRpb24pIEJFRk9SRSB3ZSBub3JtYWxpemUgb3VyIExpZ2h0RGlyXFxuXFx0XFx0ZmxvYXQgRCA9IGxlbmd0aChMaWdodERpcik7XFxuXFx0XFx0XFxuXFx0XFx0Ly9ub3JtYWxpemUgb3VyIHZlY3RvcnNcXG5cXHRcXHR2ZWMzIE4gPSBub3JtYWxpemUoTm9ybWFsTWFwICogMi4wIC0gMS4wKTtcXG5cXHRcXHR2ZWMzIEwgPSBub3JtYWxpemUoTGlnaHREaXIpO1xcblxcdFxcdFxcblxcdFxcdC8vU29tZSBub3JtYWwgbWFwcyBtYXkgbmVlZCB0byBiZSBpbnZlcnRlZCBsaWtlIHNvOlxcblxcdFxcdC8vIE4ueSA9IDEuMCAtIE4ueTtcXG5cXG5cXHRcXHQvL1ByZS1tdWx0aXBseSBsaWdodCBjb2xvciB3aXRoIGludGVuc2l0eVxcblxcdFxcdC8vVGhlbiBwZXJmb3JtIFxcXCJOIGRvdCBMXFxcIiB0byBkZXRlcm1pbmUgb3VyIGRpZmZ1c2UgdGVybVxcblxcdFxcdHZlYzMgRGlmZnVzZSA9IChMaWdodENvbG9yW2ldLnJnYiAqIExpZ2h0Q29sb3JbaV0uYSkgKiBtYXgoZG90KE4sIEwpLCAwLjApO1xcblxcblxcdFxcdC8vcHJlLW11bHRpcGx5IGFtYmllbnQgY29sb3Igd2l0aCBpbnRlbnNpdHlcXG5cXHRcXHR2ZWMzIEFtYmllbnQgPSBBbWJpZW50Q29sb3IucmdiICogQW1iaWVudENvbG9yLmE7XFxuXFx0XFx0XFxuXFx0XFx0Ly9jYWxjdWxhdGUgYXR0ZW51YXRpb25cXG5cXHRcXHRmbG9hdCBBdHRlbnVhdGlvbiA9IDEuMCAvICggRmFsbG9mZltpXS54ICsgKEZhbGxvZmZbaV0ueSpEKSArIChGYWxsb2ZmW2ldLnoqRCpEKSApO1xcblxcdFxcdFxcblxcdFxcdC8vdGhlIGNhbGN1bGF0aW9uIHdoaWNoIGJyaW5ncyBpdCBhbGwgdG9nZXRoZXJcXG5cXHRcXHR2ZWMzIEludGVuc2l0eSA9IEFtYmllbnQgKyBEaWZmdXNlICogQXR0ZW51YXRpb247XFxuXFx0XFx0dmVjMyBGaW5hbENvbG9yID0gRGlmZnVzZUNvbG9yLnJnYiAqIEludGVuc2l0eTtcXG5cXG5cXHRcXHRTdW0gKz0gRmluYWxDb2xvcjtcXG5cXHR9XFxuXFxuXFx0Z2xfRnJhZ0NvbG9yID0gdkNvbG9yICogdmVjNChTdW0sIERpZmZ1c2VDb2xvci5hKTtcXG59XCI7XG5cbmZ1bmN0aW9uIGFkZENyZWRpdHMoKSB7XG4gICAgdmFyIHRleHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIHRleHQuY2xhc3NOYW1lID0gXCJjcmVkaXRzXCI7XG4gICAgdGV4dC5pbm5lckhUTUwgPSBcbiAgICAgICAgICAgICAgICAnPGRpdj48YSBocmVmPVwiaHR0cHM6Ly9naXRodWIuY29tL21hdHRkZXNsL2thbWktZGVtb3NcIj5rYW1pLWRlbW9zPC9hPjwvZGl2PidcbiAgICAgICAgICAgICAgICArICdicmljayB3YWxsIHRleHR1cmUgYW5kIG5vcm1hbCBtYXAgYnkgPGEgaHJlZj1cImh0dHA6Ly9vcGVuZ2FtZWFydC5vcmcvY29udGVudC9icmljay13YWxsXCI+Sm9zaXBLbGFkYXJpYzwvYT4nO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGV4dCk7XG59XG5cblxuZG9tcmVhZHkoZnVuY3Rpb24oKSB7XG4gICAgLy9DcmVhdGUgYSBuZXcgV2ViR0wgY2FudmFzIHdpdGggdGhlIGdpdmVuIHNpemVcbiAgICB2YXIgY29udGV4dCA9IG5ldyBXZWJHTENvbnRleHQod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cbiAgICAvL3RoZSAndmlldycgaXMgdGhlIERPTSBjYW52YXMsIHNvIHdlIGNhbiBqdXN0IGFwcGVuZCBpdCB0byBvdXIgYm9keVxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoIGNvbnRleHQudmlldyApO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUub3ZlcmZsb3cgPSBcImhpZGRlblwiO1xuICAgIGRvY3VtZW50LmJvZHkuc3R5bGUubWFyZ2luID0gXCIwXCI7XG5cbiAgICBhZGRDcmVkaXRzKCk7XG5cbiAgICAvL1dlIHVzZSBTcHJpdGVCYXRjaCB0byBkcmF3IHRleHR1cmVzIGFzIDJEIHF1YWRzXG4gICAgdmFyIGJhdGNoID0gbmV3IFNwcml0ZUJhdGNoKGNvbnRleHQpO1xuICAgIFxuICAgIHZhciB0ZXhEaWZmdXNlID0gbmV3IFRleHR1cmUoY29udGV4dCwgXCJpbWcvYnJpY2stZGlmZnVzZS5wbmdcIik7XG4gICAgdmFyIHRleE5vcm1hbCAgPSBuZXcgVGV4dHVyZShjb250ZXh0LCBcImltZy9icmljay1ub3JtYWxzLnBuZ1wiKTtcblxuICAgIC8vc2V0IHRoZSBmaWx0ZXJzIGZvciBvdXIgdGV4dHVyZXNcbiAgICB0ZXhOb3JtYWwuc2V0V3JhcChUZXh0dXJlLldyYXAuUkVQRUFUKTtcbiAgICB0ZXhOb3JtYWwuc2V0RmlsdGVyKFRleHR1cmUuRmlsdGVyLkxJTkVBUik7XG5cbiAgICB0ZXhEaWZmdXNlLnNldFdyYXAoVGV4dHVyZS5XcmFwLlJFUEVBVCk7ICAgIFxuICAgIHRleERpZmZ1c2Uuc2V0RmlsdGVyKFRleHR1cmUuRmlsdGVyLkxJTkVBUik7XG5cbiAgICAvL3NldHVwIG91ciBzaGFkZXJcbiAgICB2YXIgc2hhZGVyID0gbmV3IFNoYWRlclByb2dyYW0oY29udGV4dCwgdmVydCwgZnJhZyk7XG4gICAgaWYgKHNoYWRlci5sb2cpXG4gICAgICAgIGNvbnNvbGUud2FybihzaGFkZXIubG9nKTtcblxuICAgIC8vbm90aWNlIGhvdyB3ZSBiaW5kIG91ciBzaGFkZXIgYmVmb3JlIHNldHRpbmcgdW5pZm9ybXMhXG4gICAgc2hhZGVyLmJpbmQoKTtcbiAgICBzaGFkZXIuc2V0VW5pZm9ybWkoXCJ1X25vcm1hbHNcIiwgMSk7XG5cbiAgICAvL3BhcmFtZXRlcnMgZm9yIHRoZSBsaWdodGluZyBzaGFkZXJcbiAgICB2YXIgYW1iaWVudENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShbMC4wLCAwLjAsIDAuMCwgMC4yXSk7XG5cbiAgICAvL3RoZSBkZWZhdWx0IGxpZ2h0IFogcG9zaXRpb25cbiAgICB2YXIgbGlnaHRaID0gMC4wNzU7XG5cbiAgICAvL3RoZXNlIHBhcmFtZXRlcnMgYXJlIHBlci1saWdodFxuICAgIHZhciBsaWdodENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShcbiAgICAgICAgICAgIFsxLjAsIDEuMCwgMS4wLCAxLjAsXG4gICAgICAgICAgICAgMC42LCAwLjgsIDAuNSwgMC41XSk7XG4gICAgdmFyIGZhbGxvZmYgPSBuZXcgRmxvYXQzMkFycmF5KFxuICAgICAgICAgICAgWzAuNCwgNy4wLCA0MC4wLFxuICAgICAgICAgICAgIDAuMiwgMS4wLCA0MC4wXSk7XG4gICAgdmFyIGxpZ2h0UG9zID0gbmV3IEZsb2F0MzJBcnJheShcbiAgICAgICAgICAgIFswLCAwLCBsaWdodFosXG4gICAgICAgICAgICAgMCwgMCwgbGlnaHRaXSk7XG5cbiAgICB2YXIgbW91c2UgPSB7eDowLCB5OjB9LFxuICAgICAgICBzY3JvbGwgPSAwLFxuICAgICAgICB0aW1lICAgPSAwO1xuICAgIFxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vtb3ZlXCIsIGZ1bmN0aW9uKGV2KSB7XG4gICAgICAgIG1vdXNlLnggPSBldi5wYWdlWCAvIGNvbnRleHQud2lkdGg7XG4gICAgICAgIG1vdXNlLnkgPSAxLjAgLSBldi5wYWdlWSAvIGNvbnRleHQuaGVpZ2h0O1xuICAgIH0sIHRydWUpO1xuXG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJyZXNpemVcIiwgZnVuY3Rpb24oZXYpIHtcbiAgICAgICAgY29udGV4dC5yZXNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG4gICAgfSwgdHJ1ZSk7XG5cbiAgICB2YXIgbGFzdFRpbWUgPSAwLFxuICAgICAgICBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgZnVuY3Rpb24gcmVuZGVyKCkge1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVuZGVyKTtcbiAgICAgICAgXG4gICAgICAgIC8vZ2V0IGRlbHRhIHRpbWUgZm9yIHNtb290aCBhbmltYXRpb25cbiAgICAgICAgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgdmFyIGRlbHRhID0gKG5vdyAtIGxhc3RUaW1lKSAvIDEwMDA7XG4gICAgICAgIGxhc3RUaW1lID0gbm93O1xuXG4gICAgICAgIHZhciBnbCA9IGNvbnRleHQuZ2w7XG5cblxuICAgICAgICAvL2FuaW1hdGUgdGhlIGNhbWVyYSBieSBzY3JvbGxpbmcgVVYgb2Zmc2V0c1xuICAgICAgICB0aW1lICs9IDAuMjUgKiBkZWx0YTtcblxuICAgICAgICAvL3dlIGNhbiBzY2FsZSB0aGUgY29vcmRpbmF0ZXMgdG8gY3JlYXRlIGEgXCJ6b29tXCIgICAgICAgIFxuICAgICAgICB2YXIgem9vbSA9IDEgLSAoIChNYXRoLnNpbih0aW1lKSAvIDIgKyAwLjUpICogMC4xNSApO1xuXG4gICAgICAgIC8vZGV0ZXJtaW5lIGhvdyBtYW55IHJlcGVhdHMgd2UgbmVlZCB0byBmaXQgbmljZWx5IHdpdGhpbiB0aGUgd2luZG93IFxuICAgICAgICB2YXIgeHJlcGVhdHMgPSAoY29udGV4dC53aWR0aCAvIHRleERpZmZ1c2Uud2lkdGgpICogem9vbTtcbiAgICAgICAgdmFyIHlyZXBlYXRzID0gKGNvbnRleHQuaGVpZ2h0IC8gdGV4RGlmZnVzZS5oZWlnaHQpICogem9vbTtcblxuICAgICAgICAvL25vdyBvZmZzZXQgdGhlIHBvc2l0aW9uIG9mIHRoZSBVVnMgd2l0aCBzb21lIHNpbiBtYWdpY1xuICAgICAgICB2YXIgeHBvcyA9IC14cmVwZWF0cyArIE1hdGguc2luKE1hdGguc2luKHRpbWUqMC41KSksIFxuICAgICAgICAgICAgeXBvcyA9IC15cmVwZWF0cyArIE1hdGguc2luKHRpbWUqMC4yNSk7XG5cblxuICAgICAgICAvL2dldCB0aGUgR0wgcmVuZGVyaW5nIGNvbnRleHRcbiAgICAgICAgdmFyIGdsID0gY29udGV4dC5nbDtcblxuICAgICAgICAvL2NsZWFyIHRoZSBjb250ZXh0XG4gICAgICAgIGdsLmNsZWFyKGdsLkNPTE9SX0JVRkZFUl9CSVQpO1xuICAgICAgICBcbiAgICAgICAgLy93ZSBuZWVkIHRvIHNldCB0aGUgc2hhZGVyIG9mIG91ciBiYXRjaC4uLlxuICAgICAgICBiYXRjaC5zaGFkZXIgPSBzaGFkZXI7XG5cbiAgICAgICAgLy9tYWtlIHN1cmUgb3VyIGJhdGNoIGlzIG9yaWVudGVkIHdpdGggdGhlIHdpbmRvdyBzaXplXG4gICAgICAgIGJhdGNoLnJlc2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcblxuICAgICAgICAvL2RyYXcgb3VyIGltYWdlIHRvIHRoZSBzaXplIG9mIHRoZSBjYW52YXNcbiAgICAgICAgLy90aGlzIHdpbGwgYmluZCBvdXIgc2hhZGVyXG4gICAgICAgIGJhdGNoLmJlZ2luKCk7XG5cbiAgICAgICAgLy90aGUgZmlyc3QgbGlnaHQgd2lsbCBiZSBiYXNlZCBvbiBtb3VzZVxuICAgICAgICBsaWdodFBvc1swXSA9IG1vdXNlLng7XG4gICAgICAgIGxpZ2h0UG9zWzFdID0gbW91c2UueTtcblxuICAgICAgICAvL3RoZSBzZWNvbmQgbGlnaHQgd2UnbGwganVzdCBtb3ZlIGFyb3VuZCBhIGJpdFxuICAgICAgICBsaWdodFBvc1szXSA9IChNYXRoLnNpbih0aW1lKjAuMjUpIC8gMi4wICsgMC41KTtcbiAgICAgICAgbGlnaHRQb3NbNF0gPSAoTWF0aC5zaW4odGltZSowLjc1KSAvIDIuMCArIDAuNSk7XG5cbiAgICAgICAgLy9wYXNzIG91ciBwYXJhbWV0ZXJzIHRvIHRoZSBzaGFkZXJcbiAgICAgICAgc2hhZGVyLnNldFVuaWZvcm1mKFwiUmVzb2x1dGlvblwiLCBjb250ZXh0LndpZHRoLCBjb250ZXh0LmhlaWdodCk7XG4gICAgICAgIHNoYWRlci5zZXRVbmlmb3JtZnYoXCJBbWJpZW50Q29sb3JcIiwgYW1iaWVudENvbG9yKTtcblxuICAgICAgICAvL25vdGUgdGhhdCB0aGVzZSBhcmUgYXJyYXlzLCBhbmQgd2UgbmVlZCB0byBleHBsaWNpdGx5IHNheSB0aGUgY29tcG9uZW50IGNvdW50XG4gICAgICAgIHNoYWRlci5zZXRVbmlmb3JtZnYoXCJMaWdodFBvc1swXVwiLCBsaWdodFBvcywgMyk7XG4gICAgICAgIHNoYWRlci5zZXRVbmlmb3JtZnYoXCJGYWxsb2ZmWzBdXCIsIGZhbGxvZmYsIDMpO1xuICAgICAgICBzaGFkZXIuc2V0VW5pZm9ybWZ2KFwiTGlnaHRDb2xvclswXVwiLCBsaWdodENvbG9yLCA0KTtcblxuICAgICAgICB0ZXhOb3JtYWwuYmluZCgxKTsgIC8vYmluZCBub3JtYWxzIHRvIHVuaXQgMVxuICAgICAgICB0ZXhEaWZmdXNlLmJpbmQoMCk7IC8vYmluZCBkaWZmdXNlIHRvIHVuaXQgMFxuXG4gICAgICAgIFxuXG4gICAgICAgIGJhdGNoLmRyYXcodGV4RGlmZnVzZSwgMCwgMCwgY29udGV4dC53aWR0aCwgY29udGV4dC5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeHBvcywgeXBvcywgeHBvcyt4cmVwZWF0cywgeXBvcyt5cmVwZWF0cyk7XG4gICAgICAgICAgICBcbiAgICAgICAgYmF0Y2guZW5kKCk7IFxuICAgIH1cblxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXIpO1xufSk7Il19
