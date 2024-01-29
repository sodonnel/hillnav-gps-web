# Generate the cert and key with:
#
#  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365
# 
# Then run with ruby https_server.rb

require 'webrick'
require 'webrick/https'
require 'openssl'

cert = OpenSSL::X509::Certificate.new File.read './cert.pem'
pkey = OpenSSL::PKey::RSA.new File.read './key.pem'

doc_root = File.join(__dir__, '..', '..')

# Serve a specific build
if ARGV.length > 0
  doc_root = File.join(doc_root, ARGV[0])
end
puts "Serving #{doc_root}"

server = WEBrick::HTTPServer.new(:Port => 8000,
                                 :SSLEnable => true,
                                 :SSLCertificate => cert,
                                 :SSLPrivateKey => pkey,
                                 :DocumentRoot => doc_root)

server_insecure = WEBrick::HTTPServer.new(:Port => 8001,
                                          :SSLEnable => false,
                                          :DocumentRoot => doc_root)

trap 'INT' do
  server.shutdown
  server_insecure.shutdown
end

[
  Thread.new { server.start },
  Thread.new { server_insecure.start }
].each(&:join)
