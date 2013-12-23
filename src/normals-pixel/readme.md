# normals-pixel

This is very similar to the [normals](../normals) demo, but styled for pixel art. 

There are two main considerations. The first is to use a "cel shading" for the light, so that it does not look like a smooth gradient. One simple way of achieving this is to use a series of if-else statements and clamp the color. See the [Toon Shading section here](http://prideout.net/blog/?p=22). 

The next consideration is that we want the edge pixels of the light to scale along with the pixels of our sprites. One way of achieving this is to draw our scene to an FBO with the light shader, and then render it with a default shader to the screen at a larger size. Since FBO origin is lower-left, and texture region is upper-left, we have to flip the coordinates. And since our lighting relies on gl_FragCoord (which gives us a lower-left screen coord in pixels), we need to adjust for that when calculating the normalized light (aka mouse) position. 

The normal map was drawn by hand, and it's pretty rough. With normals in pixel art, it's more a matter of "how it feels" than how accurate it is to reality.  
![pixels](http://mattdesl.github.io/kami-demos/release/img/pixel-normals.png)

You can read more about the theory of normal mapping for 2D games here:  
https://github.com/mattdesl/lwjgl-basics/wiki/ShaderLesson6

Result:  
![normals](http://i.imgur.com/e8vaX88.png)

The platformer art was created by [Kenney](http://opengameart.org/content/platformer-art-pixel-edition).