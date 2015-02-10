'use strict';

var gulp = require('gulp'),
    gutil = require('gulp-util'),
    jshint = require('gulp-jshint'),
    source = require('vinyl-source-stream'),
    browserify = require('browserify'),
    sourcemaps = require('gulp-sourcemaps'),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer'),
    watchify = require('watchify'),
    browserify = require('browserify'),
    minifyCSS = require('gulp-minify-css'),
    clean = require('gulp-clean'),
    deploy = require('gulp-gh-pages');


var bundler = watchify(browserify('./app/js/app.js', watchify.args));
// add any other browserify options or transforms here
bundler.transform('brfs');

gulp.task('browserify', bundle); // so you can run `gulp js` to build the file
bundler.on('update', bundle); // on any dep update, runs the bundler

function bundle() {
  return bundler.bundle()
    // log errors if they happen
    .on('error', gutil.log.bind(gutil, 'Browserify Error'))
    .pipe(source('bundle.js'))
    // optional, remove if you dont want sourcemaps
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
      .pipe(sourcemaps.write('./')) // writes .map file
    //
    .pipe(gulp.dest('./dist'));
}

/**
 * Push build to gh-pages
 */
gulp.task('deploy', ['views', 'images', 'minify-css', 'lint', 'browserify'], function() {
  return gulp.src("./dist/**/*")
    .pipe(deploy())
});

gulp.task('dev', ['views', 'images', 'copy-bower-components', 'copy-js-lib-components', 'minify-css', 'lint', 'browserify', 'watch'], function() {});

gulp.task('lint', function() {
  gulp.src(['./app/**/*.js', '!./app/bower_components/**', '!./app/js/lib/**'])
  .pipe(jshint())
  .pipe(jshint.reporter('default'))
  .pipe(jshint.reporter('fail'));
});

gulp.task('clean', function() {
    gulp.src('./dist/*')
      .pipe(clean({force: true}));
});

gulp.task('copy-bower-components', function () {
  gulp.src('./app/bower_components/**')
    .pipe(gulp.dest('dist/bower_components'));
});

gulp.task('copy-js-lib-components', function () {
  gulp.src('./app/js/lib/**')
    .pipe(gulp.dest('dist/js/lib'));
});

gulp.task('minify-css', function() {
  var opts = {comments:true, spare:true};
  gulp.src(['./app/**/*.css', '!./app/bower_components/**'])
    .pipe(minifyCSS(opts))
    .pipe(gulp.dest('./dist/'))
});

gulp.task('views', function() {
  gulp.src('app/index.html')
  .pipe(gulp.dest('dist/'));

  gulp.src('app/templates/**/*')
  .pipe(gulp.dest('dist/templates/'));
});

gulp.task('images', function() {
  gulp.src('app/images/**/*')
  .pipe(gulp.dest('dist/images/'));
});


gulp.task('watch', ['copy-bower-components', 'copy-js-lib-components', 'lint'], function() {
  gulp.watch(['app/js/**/*.js'],[
    'lint',
    'browserify'
  ]);

  gulp.watch(['app/**/*.html'], [
    'views'
  ]);

  gulp.watch(['app/images/*'], [
    'images'
  ]);

  gulp.watch(['app/css/*.css'], [
    'minify-css'
  ]);
});

gulp.task('default', ['dev']);
