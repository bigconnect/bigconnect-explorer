/*globals module:false*/

var requireConfig = require('./js/require.config');

module.exports = function(grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt);
    grunt.loadTasks('grunt-tasks');

    var compressionFiles = ['jsc/', 'libs/', 'css/'].map(dir => {
        var cfg = {};
        if (dir === 'libs/') {
  	    cfg = { src: Object.values(requireConfig.paths)
                .filter(p => p.indexOf('../libs') === 0)
                .map(p => p.replace('../libs/', '') + '.js') };
            // Not in require config (relative to libs)
            cfg.src.push('@babel/polyfill/dist/polyfill.min.js');
            cfg.src.push('requirejs/require.js');
            cfg.src.push('gridstack/dist/gridstack.min.css');
            cfg.src.push('video.js/dist/video-js.min.css');
        } else {
            cfg = { src: ['**/*.*'] };
        }

        return Object.assign({}, cfg, {
            expand: true, cwd: dir, dest: dir, extDot: 'last',
            rename: function(dest, src, cfg) {
                var ext = grunt.task.current.target === 'brotli' ? 'br' : 'gz';
                return `${dest}/${src}.${ext}`
            },
            filter: function(src) {
                return !((/\.(gz|br)$/).test(src));
            }
        })
    })

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            src: ['jsc', 'css', 'imgc'],
            libs: ['libs']
        },

        less: {
            options: {
                paths: ['less'],
                sourceMap: true,
                sourceMapFilename: 'css/bc.css.map',
                sourceMapURL: 'bc.css.map',
                sourceMapRootpath: '/'
            },
            development: {
                files: {
                    'css/bc.css': 'less/bc.less'
                }
            },
            developmentContrast: {
                files: {
                    'css/bc-contrast.css': 'less/bc.less'
                },
                options: {
                    modifyVars: {
                        'pane-background': '#e4e4e4'
                    }
                }
            },
            productionContrast: {
                files: {
                    'css/bc-contrast.css': 'less/bc.less'
                },
                options: {
                    compress: true,
                    modifyVars: {
                        'pane-background': '#e4e4e4'
                    }
                }
            },
            production: {
                files: {
                    'css/bc.css': 'less/bc.less'
                },
                options: {
                    compress: true,
                    sourceMap: false
                }
            }
        },

        babel: {
            js: {
                options: {
                    comments: false,
                    compact: true,
                    sourceMap: true
                },
                files: [
                    { expand: true, cwd: 'js', src: ['**/*.js'], dest: 'jsc' },
                    { expand: true, cwd: 'js', src: ['**/*.jsx'], dest: 'jsc', ext: '.js' }
                ]
            },
            production: {
            	options: {
                    comments: false,
                    compact: true,
                    sourceMap: false
                },
                files: [
                    { expand: true, cwd: 'js', src: ['**/*.js'], dest: 'jsc' },
                    { expand: true, cwd: 'js', src: ['**/*.jsx'], dest: 'jsc', ext: '.js' }
                ]
            }
        },

        compress: {
            gzip: {
                options: { mode: 'gzip' },
                files: compressionFiles
            },
            brotli: {
                options: { mode: 'brotli' },
                files: compressionFiles
            }
        },

        copy: {
            templates: {
                files: [
                    {expand: true, cwd: 'js/', src: ['**/*.hbs', '**/*.ejs', '**/*.css'], dest: 'jsc'}
                ],
            },
        },

        handlebars: {
            compile: {
                options: {
                    amd: true,
                    namespace: false
                },
                files: [
                    { expand: true, cwd: 'js', src: ['**/*.hbs'], dest: 'jsc/', ext: '.hbs.js' }
                ]
            }
        },

        amdwrap: {
            wrapNodeModules: {
                expand: true,
                cwd: 'libs/',
                src: requireConfig.amdWrap,
                dest: 'libs/amd-wrap'
            }
        },

        eslint: {
            development: {
                src: ['js/**/*.js', 'js/**/*.jsx']
            },
            ci: {
                src: ['js/**/*.js', 'js/**/*.jsx'],
                options: {
                    format: 'checkstyle',
                    outputFile: 'build/checkstyle.xml'
                }
            }
        },

        sprite: {
            all: {
                src: 'img/glyphicons/*@2x.png',
                dest: 'imgc/sprites/glyphicons.png',
                destCss: 'imgc/sprites/glyphicons.json',
                padding: 2
            }
        },

        'transform-sprite': {
            all: 'imgc/sprites/glyphicons.json'
        },

        watch: {
            options: {
                dateFormat: function(time) {
                    grunt.log.ok('The watch finished in ' + (time / 1000).toFixed(2) + 's. Waiting...');
                },
                spawn: false,
                interrupt: false
            },
            css: {
                files: ['less/**/*.less', 'libs/**/*.css', 'libs/**/*.less'],
                tasks: ['less:development', 'notify:css']
            },
            img: {
                files: ['img/glyphicons/*@2x.png'],
                tasks: ['sprite']
            },
            compiledCss: {
                files: ['css/bc.css'],
                options: {
                    debounceDelay: 0,
                    livereload: {
                        host: 'localhost',
                        port: 35728
                    }
                }
            },
            scripts: {
                files: [
                    'js/**/*.js',
                    'js/**/*.jsx',
                    'js/**/*.less',
                    'js/**/*.css',
                    'js/**/*.ejs',
                    'js/**/*.hbs',
                    'js/**/*.vsh',
                    'js/**/*.fsh'
                ],
                tasks: ['babel:js', 'copy:templates', 'handlebars:compile', 'notify:js'],
                options: {
                    livereload: {
                        host: 'localhost',
                        port: 35728
                    }
                }
            }
        },

        notify: {
            js: {
                options: {
                    title: 'BigConnect Explorer',
                    message: 'Scripts finished'
                }
            },
            css: {
                options: {
                    title: 'BigConnect Explorer',
                    message: 'Less finished'
                }
            }
        },

        'copy-frontend': {}
      });


      // Speed up babel by only checking changed files
      // ensure we still ignore files though
      var initialBabelFiles = grunt.config('babel.js.files');
      grunt.event.on('watch', function(action, filepath) {
          grunt.config('babel.js.files', initialBabelFiles.map(function(f) {
              var filePathRelativeToCwd = filepath.replace(/^js\//, '');
              var matchingBabelFiles = grunt.file.match(f, f.src, filePathRelativeToCwd);

              // this does not work on Linux: the matchingBabelFiles[i] does not start with js/
              //
              // if(matchingBabelFiles) {
              //     for (var i = 0, len = matchingBabelFiles.length; i < len; i++) {
              //         matchingBabelFiles[i] = matchingBabelFiles[i].substr('js/'.length);
              //     }
              // }


              return Object.assign({}, f, { src: matchingBabelFiles})
          }));
      });

      grunt.registerTask('sprites', ['sprite:all', 'transform-sprite']);

      grunt.registerTask('deps', 'Install Webapp Dependencies',
         ['clean:libs', 'copy-frontend', 'amdwrap']);

      grunt.registerTask('development', 'Build js/less for development',
         ['clean:src', 'less:development', 'babel:js', 'copy:templates', 'handlebars:compile', 'sprites']);

      grunt.registerTask('production', 'Build js/less for production',
         ['clean:src', 'less:production', 'babel:production', 'copy:templates', 'handlebars:compile', 'sprites', 'compress']);

      grunt.registerTask('default', ['development']);
};
