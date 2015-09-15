module.exports = function(grunt) {
	grunt.initConfig({
		uglify: {
			options: {
				compress: {}
			},
			in_view: {
				files: {
					'jquery.dynamite.min.js': ['jquery.dynamite.js']
				}
			}
		},
		watch: {
			uglify: {
				files: ['jquery.dynamite.js', 'Gruntfile.js'],
				tasks: ['uglify']
			}
		},
		release: {
		}
	});

	grunt.loadNpmTasks('grunt-release');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.registerTask('default', ['watch']);
	grunt.registerTask('publish', ['release']);
};