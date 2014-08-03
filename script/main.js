(function(){
    'use strict';

    var vPlane = [
        1.0, 1.0, 0.0,
        0.0, 1.0, 0.0,
        1.0, 0.0, 0.0,
        0.0, 0.0, 0.0
    ];

    var vLines = [
        0.0, 0.0, 0.0, 1.0, 0.0, 0.0,
        1.0, 0.0, 0.0, 1.0, 1.0, 0.0,
        1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
        0.0, 1.0, 0.0, 0.0, 0.0, 0.0
    ];

    var canvas = document.getElementsByTagName('canvas')[0];
    var w = [ 512, 512 ];

    canvas.width = w[0];
    canvas.height = w[1];

    var gl = canvas.getContext('webgl');
    gl.viewport( -w[0], -w[1], w[0] * 2, w[1] * 2 );
    gl.clearColor( 0.0, 0.0, 1.0, 1.0 );

    /**
     * @param {Number[]} sz vec2
     * @constructor
     */
    function Texture( sz ) {
        var tex = gl.createTexture();
        gl.bindTexture( gl.TEXTURE_2D, tex );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR );

        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
        gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );

        gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, sz[0], sz[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
        this.tex = tex;
        this.id = null;
    }

    /**
     * @returns {WebGLTexture}
     */
    Texture.prototype.get = function() {
        return this.tex;
    };

    /**
     * @param {Number} id
     */
    Texture.prototype.setSlot = function( id ) {
        this.id = id;
        gl.activeTexture( this.id );
        gl.bindTexture( gl.TEXTURE_2D, this.tex );
    };

    /**
     * @param {WebGLUniformLocation} uniform
     */
    Texture.prototype.assignUniform = function( uniform ) {
        if( this.id === null ) throw new Error('No slot assigned.');
        gl.uniform1i( uniform, this.id - gl.TEXTURE0 );
    };

    /**
     * @constructor
     */
    function Framebuffer() {
        this.fb = gl.createFramebuffer();
    }

    /**
     * void
     */
    Framebuffer.prototype.use = function() {
        gl.bindFramebuffer( gl.FRAMEBUFFER, this.fb );
    };

    /**
     * @param {Texture} tex
     */
    Framebuffer.prototype.target = function( tex ) {
        this.use();
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex.get(),
            0
        );
    };

    /**
     * @param id
     * @constructor
     */
    function Shader( id ) {
        var shaderScript = document.getElementById( id );
        if( !shaderScript ) {
            throw new Error( 'Shader by ID not found.' );
        }

        var source = '';
        var k = shaderScript.firstChild;
        while( k ) {
            if( k.nodeType == 3 ) source += k.textContent;
            k = k.nextSibling;
        }

        var types = {};
        types["x-shader/x-fragment"] = gl.FRAGMENT_SHADER;
        types["x-shader/x-vertex"] = gl.VERTEX_SHADER;
        var type = types[ shaderScript.type ];
        if( !type ) {
            throw new Error( 'Unknown shader type.' );
        }
        var shader = gl.createShader( type );

        gl.shaderSource( shader, source );
        gl.compileShader( shader );

        if( !gl.getShaderParameter( shader, gl.COMPILE_STATUS ) ) {
            console.log( id, gl.getShaderInfoLog( shader ) );
            throw new Error( 'Shader "' + id + '": ' + gl.getShaderInfoLog( shader ) );
        }

        this.shader = shader;
    }

    /**
     * @returns {WebGLShader}
     */
    Shader.prototype.get = function() {
        return this.shader;
    };

    /**
     * @constructor
     */
    var Program = function() {
        this.program = gl.createProgram();
    };

    /**
     * @param {WebGLShader} shader
     */
    Program.prototype.attach = function( shader ) {
        gl.attachShader( this.program, shader );
    };

    /**
     * void
     */
    Program.prototype.compile = function() {
        gl.linkProgram( this.program );

        if( !gl.getProgramParameter( this.program, gl.LINK_STATUS ) ) {
            throw new Error( 'Could not initialise shaders' );
        }
    };

    /**
     * void
     */
    Program.prototype.use = function() {
        gl.useProgram( this.program );
    };

    /**
     * @param {string} name
     * @returns {WebGLUniformLocation}
     */
    Program.prototype.uniform = function( name ) {
        return gl.getUniformLocation( this.program, name );
    };

    /**
     * @param {string} name
     * @returns {int}
     */
    Program.prototype.attrib = function( name ) {
        var result = gl.getAttribLocation( this.program, name );
        gl.enableVertexAttribArray( result );
        return result;
    };

    /**
     * @param {string} name
     * @param {Object} vocabulary uniform getters by name
     * @constructor
     */
    function NavierStokesPass( name, vocabulary ) {
        var scriptId = 'shader-' + name;

        var program = new Program();
        program.attach( new Shader( 'shader-vertex' ).get() );
        program.attach( new Shader( scriptId ).get() );
        program.compile();
        this.program = program;

        var script = document.getElementById( scriptId );

        var dataset = script.dataset;
        if( 'in' in dataset ) {
            this.in = _( dataset['in'].split(',') ).map( function( x ) {
                return [ program.uniform( x ), vocabulary[ x ] ];
            } );
        } else {
            this.in = [];
        }
        this.out = vocabulary[ dataset['out'] ];

        this.name = name;
    }

    /**
     * @param {Framebuffer} fb
     * @param {WebGLBuffer} vbo
     */
    NavierStokesPass.prototype.use = function( fb, vbo ) {
        this.program.use();

        gl.bindBuffer( gl.ARRAY_BUFFER, vbo );
        gl.vertexAttribPointer( this.program.attrib('v'), 3, gl.FLOAT, false, 0, 0 );

        var that = this;

        _( this.in ).each( function( x ) {
            var uni = x[0]; // uniform location
            var f = x[1]; // value provider function
            var value = f();
            if( typeof value == 'number' ) {
                gl.uniform1f( uni, value );
            } else if( value instanceof Array && value.length == 2 ) {
                gl.uniform2f( uni, value[0], value[1] );
            } else if( value instanceof Texture ) {
                value.assignUniform( uni );
            } else {
                throw new Error( 'Unhandled uniform value type ' + typeof value );
            }
        } );

        if( this.out() ) {
            fb.target( this.out() );
        } else {
            gl.bindFramebuffer( gl.FRAMEBUFFER, null );
        }

        gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
    };


    var velocity = new Texture( w );
    var pressure = new Texture( w );
    var tempcanv = new Texture( w );
    var carrier1 = new Texture( w );
    var carrier2 = new Texture( w );

    velocity.setSlot( gl.TEXTURE0 );
    pressure.setSlot( gl.TEXTURE1 );
    tempcanv.setSlot( gl.TEXTURE2 );
    carrier1.setSlot( gl.TEXTURE3 );
    carrier2.setSlot( gl.TEXTURE4 );

    var last = [ 0, 0 ];
    var mouse = [ 0, 0 ];

    var active = false;
    var timeout;
    var layer2 = document.getElementById('layer-2');
    layer2.addEventListener( 'mousemove', function( e ) {
        clearTimeout( timeout );

        var target = e.target || e.srcElement,
            rect = target.getBoundingClientRect(),
            offsetX = e.clientX - rect.left,
            offsetY = e.clientY - rect.top;

        var x =     offsetX / rect.height;
        var y = 1 - offsetY / rect.width;
        var dx = x - 0.5;
        var dy = y - 0.5;
        if( dx * dx + dy * dy < 0.006 ) active = true;
        mouse[0] = x - last[0];
        mouse[1] = y - last[1];
        last[0] = x;
        last[1] = y;
        timeout = setTimeout( function() { mouse = [ 0, 0 ]; }, 25 );
    }, false );

    var vocab = {
        velocity: function() { return velocity; },
        pressure: function() { return pressure; },
        tempcanv: function() { return tempcanv; },
        carrier1: function() { return carrier1; },
        carrier2: function() { return carrier2; },
        mouse:    function() { return mouse; },
        last:     function() { return last; },
        screen:   function() { return null; }
    };

    var fb = new Framebuffer();

    var vboPlane = gl.createBuffer();
    vboPlane.itemSize = 3;
    gl.bindBuffer( gl.ARRAY_BUFFER, vboPlane );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vPlane ), gl.STATIC_DRAW );

    var vboLines = gl.createBuffer();
    vboLines.itemSize = 4;
    gl.bindBuffer( gl.ARRAY_BUFFER, vboLines );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vLines ), gl.STATIC_DRAW );

    var pBoundary = new Program();
    pBoundary.attach( new Shader( 'shader-vertex' ).get() );
    pBoundary.attach( new Shader( 'shader-boundary' ).get() );
    pBoundary.compile();
    var uBoundary = pBoundary.uniform( 'c' );

    var passes = [];

    var passAdvect = new NavierStokesPass( 'advect', vocab );
    var passCopyAdvect = new NavierStokesPass( 'copy-advect', vocab );
    var passAdvectVelocity = new NavierStokesPass( 'advect-velocity', vocab );

    var passJacobi = new NavierStokesPass( 'jacobi', vocab );
    var passCopyJacobi = new NavierStokesPass( 'copy-jacobi', vocab );

    var passInput = new NavierStokesPass( 'input', vocab );
    var passDivergence = new NavierStokesPass( 'divergence', vocab );
    var passGradient = new NavierStokesPass( 'gradient', vocab );

    var job = _.map( passes, function( x ) {
        return new NavierStokesPass( x, vocab );
    } );

    var passInitial = new NavierStokesPass( 'init', vocab );
    var passFinal = new NavierStokesPass( 'final', vocab );

    gl.bindBuffer( gl.ARRAY_BUFFER, vboPlane );
    gl.vertexAttribPointer( pBoundary.attrib('v'), 3, gl.FLOAT, false, 0, 0 );

    pBoundary.use();
    gl.uniform4f( uBoundary, 0.5, 0.5, 0.5, 1.0 );

    fb.target( vocab['velocity']() );
    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    fb.target( vocab['pressure']() );
    gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

    passInitial.use( fb, vboPlane );

    var fps = 0;
    var renderStart = new Date().getTime();
    var render = function() {
        requestAnimationFrame( render );

        if( active ) {
            passAdvect.use( fb, vboPlane );
            passCopyAdvect.use( fb, vboPlane );
            passAdvectVelocity.use( fb, vboPlane );
            for( var i = 0; i < Math.min( 90, Math.max( 20, fps * 2 - 60 ) ); i++ ) {
                passJacobi.use( fb, vboPlane );
                passCopyJacobi.use( fb, vboPlane );
            }
            passInput.use( fb, vboPlane );
            passDivergence.use( fb, vboPlane );
            passGradient.use( fb, vboPlane );
        }

        passFinal.use( fb, vboPlane );

        pBoundary.use();
        gl.uniform4f( uBoundary, 0.5, 0.5, 0.5, 1.0 );

        gl.lineWidth( 10 );
        gl.bindBuffer( gl.ARRAY_BUFFER, vboLines );

        fb.target( vocab['velocity']() );
        gl.drawArrays( gl.LINES, 0, 4 );

        fb.target( vocab['pressure']() );
        gl.drawArrays( gl.LINES, 0, 4 );

        var elapsed = Math.max( 0.1, new Date().getTime() - renderStart );
        fps = fps * 0.95 + ( 1000 / elapsed ) * 0.05;
        renderStart = new Date().getTime();
    };
    render();

})();