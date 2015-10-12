module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-contrib-uglify');

  var BANNER = [
    '/*! <%= pkg.name %> v<%= pkg.version %> - <%= pkg.license %> license \n',
    '<%= grunt.template.today("yyyy-mm-dd") %> - <%= pkg.author %> */\n'
  ].join('');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    uglify: {
      dist: {
        files: { "roadmap.min.js": ["roadmap.js"] }
      },
      options: {
        banner: BANNER
      }
    },
  });

  grunt.registerTask('default', [
      'uglify'
  ]);

};
