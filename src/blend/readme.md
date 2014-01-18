## blend

This is an example of a scene-graph which utilizes the 'lighten' and 'darken' blend modes (like Photoshop). The blending is not 100% accurate; see [Skia](https://code.google.com/p/skia/source/browse/trunk/src/core/SkXfermode.cpp?spec=svn12355&r=12355) for more accurate handling of alpha, etc.

It's a very expensive operation in WebGL since we need to ping-pong off-screen buffers to sample the back-buffer for blending. It's much more efficient if you are only blending two textures together (i.e. no need for back-buffer). Because of how expensive it is, it is not very practical for games or particle effects.

In iOS 6.0+, we have `APPLE_shader_framebuffer_fetch` which allows us to achieve faster programmable blends.

On many desktops, we have `NV_texture_barrier` to solve some of the FBO ping-ponging. Unfortunately, this probably will not make its way into WebGL any time soon.
http://www.opengl.org/registry/specs/NV/texture_barrier.txt

In OpenGL 4.2 and DX11, we also have `shader_image_load_store` (and DX equivalent) for arbitrary read/write ops. This could be used for more efficient blending, too. 

Hopefully in the future WebGL will provide a better interface for programmable blending. 