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

server = WEBrick::HTTPServer.new(:Port => 8000,
                                 :SSLEnable => true,
                                 :SSLCertificate => cert,
                                 :SSLPrivateKey => pkey,
                                 :DocumentRoot => Dir::pwd)

trap 'INT' do server.shutdown end

server.start
