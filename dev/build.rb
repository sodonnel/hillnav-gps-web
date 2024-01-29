require 'fileutils'

base = "#{__dir__}/.."
build_id = Time.now.strftime("%Y%m%d%H%M%S")
build_dir = File.join(base, "build", build_id)
dirs = %W[js css images]
globs = %W[#{base}/*.html #{base}/manifest.json #{base}/sw.js]

Dir.mkdir(build_dir)
dirs.each do |dir|
  Dir.mkdir(File.join(build_dir, dir))
  globs << "#{base}/#{dir}/**/*"
end

File.open(File.join(build_dir, "cache_manifest.json"), "w") do |fh|
  fh.puts("[")
  first = true
  Dir.glob(globs) do |file|
    file.gsub!("#{base}/", '')
    FileUtils.copy(File.join(base, file), File.join(build_dir, file))
    next if file =~ /^sw\.js$/
    fh.puts(",") unless first
    first = false
    fh.print("  \"#{file}?#{build_id}\"")
  end
  fh.puts("\n]")
end

%w[index.html sw.js manifest.json].each do |file|
  system("sed -i '.bak' \"s/CACHEBUST/#{build_id}/g\" #{build_dir}/#{file}")
  File.delete("#{build_dir}/#{file}.bak")
end

puts "Build #{build_id} complete"