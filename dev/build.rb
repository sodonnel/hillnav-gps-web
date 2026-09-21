require 'fileutils'
require 'json'

base = File.expand_path("..", __dir__)
build_id = Time.now.strftime("%Y%m%d%H%M%S")
build_dir = File.join(base, "build", build_id)
globs = %W[*.html manifest.json sw.js js/**/* css/**/* images/**/*]

files = Dir.chdir(base) { Dir.glob(globs).select { |f| File.file?(f) }.sort }

files.each do |file|
  dest = File.join(build_dir, file)
  FileUtils.mkdir_p(File.dirname(dest))
  FileUtils.copy(File.join(base, file), dest)
end

# The files the service worker precaches. It ignores query strings, so these are plain paths.
# sw.js itself is never cached by the service worker.
File.write(File.join(build_dir, "cache_manifest.json"),
           JSON.pretty_generate(files - %w[sw.js]) + "\n")

%w[index.html sw.js manifest.json].each do |file|
  path = File.join(build_dir, file)
  File.write(path, File.read(path).gsub("CACHEBUST", build_id))
end

puts "Build #{build_id} complete"
