#ifdef GL_ES
precision mediump float;
#endif

//Flat shading in four steps
#define STEP_A 0.4
#define STEP_B 0.6
#define STEP_C 0.8
#define STEP_D 1.0

//attributes from vertex shader
varying vec4 vColor;
varying vec2 vTexCoord0;

//our texture samplers
uniform sampler2D u_texture0;   //diffuse map
uniform sampler2D u_normals;   //normal map

//values used for shading algorithm...
uniform vec2 Resolution;      //resolution of canvas
uniform vec4 AmbientColor;    //ambient RGBA -- alpha is intensity 

uniform vec3 LightPos;     //light position, normalized
uniform vec4 LightColor;   //light RGBA -- alpha is intensity
uniform vec3 Falloff;      //attenuation coefficients
uniform float LightSize;   //the light diameter in pixels

// uniform float Test[2];

void main() {
	//RGBA of our diffuse color
	vec4 DiffuseColor = texture2D(u_texture0, vTexCoord0);
	
	//RGB of our normal map
	vec3 NormalMap = texture2D(u_normals, vTexCoord0).rgb;
	
	//The delta position of light
	vec3 LightDir = vec3(LightPos.xy - (gl_FragCoord.xy / Resolution.xy), LightPos.z);
	
	//We ensure a fixed light size in pixels like so:
	LightDir.x /= (LightSize / Resolution.x);
	LightDir.y /= (LightSize / Resolution.y);

	//Determine distance (used for attenuation) BEFORE we normalize our LightDir
	float D = length(LightDir);
	
	//normalize our vectors
	vec3 N = normalize(NormalMap * 2.0 - 1.0);
	vec3 L = normalize(LightDir);

	//We can reduce the intensity of the normal map like so:		
	N = mix(N, vec3(0), 0.5);

	//Some normal maps may need to be inverted like so:
	// N.y = 1.0 - N.y;
	
	//perform "N dot L" to determine our diffuse term
	float df = max(dot(N, L), 0.0);

	//Pre-multiply light color with intensity
	vec3 Diffuse = (LightColor.rgb * LightColor.a) * df;

	//pre-multiply ambient color with intensity
	vec3 Ambient = AmbientColor.rgb * AmbientColor.a;
	
	//calculate attenuation
	float Attenuation = 1.0 / ( Falloff.x + (Falloff.y*D) + (Falloff.z*D*D) );

	//Here is where we apply some toon shading to the light
	if (Attenuation < STEP_A) 
		Attenuation = 0.0;
	else if (Attenuation < STEP_B) 
		Attenuation = STEP_B;
	else if (Attenuation < STEP_C) 
		Attenuation = STEP_C;
	else 
		Attenuation = STEP_D;

	//the calculation which brings it all together
	vec3 Intensity = Ambient + Diffuse * Attenuation;
	vec3 FinalColor = DiffuseColor.rgb * Intensity;

	// gl_FragColor = vec4(vec3(LightDir.x), 1.0);
	gl_FragColor = vColor * vec4(FinalColor, DiffuseColor.a);
}