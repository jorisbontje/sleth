var gulp        = require('gulp');
var deploy      = require('gulp-gh-pages');

/**
 * Push build to gh-pages
 */
gulp.task('deploy', function () {
  return gulp.src(['./frontend/**/*', '!./frontend/node_modules/**'])
    .pipe(deploy({cacheDir: '../sleth-gh-pages/'}))
});
