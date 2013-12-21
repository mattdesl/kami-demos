# shockwave

This is a simple example showing a full-screen post-processing [shockwave explosion shader](http://www.geeks3d.com/20091116/shader-library-2d-shockwave-post-processing-filter-glsl/) with Kami. 

You can read more about the concept of FBOs here:  
https://github.com/mattdesl/lwjgl-basics/wiki/FrameBufferObjects

Run the demo from the root of `kami-demos`. Note that we need `brfs` here, for inlining the shader code.

```
beefy main.js --cwd demos/shockwave --live -- -t brfs
```