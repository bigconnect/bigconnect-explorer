#!/bin/sh

# Generate keystore and truststore for Tomcat

keytool \
  -genkey \
  -keyalg RSA \
  -ext san=dns:localhost,ip:127.0.0.1,ip:::1 \
  -alias bigconnect \
  -keystore keystore.jks \
  -storepass password \
  -validity 360 \
  -keysize 2048

keytool \
  -genkey \
  -keyalg RSA \
  -keystore truststore.jks \
  -storepass password \
  -validity 360 \
  -keysize 2048

keytool -export \
  -alias bigconnect \
  -file localhost.der \
  -storepass password \
  -keystore keystore.jks


keytool -import \
        -alias bigconnect \
        -file localhost.der \
        -keystore truststore.jks \
        -storepass password \
        -noprompt

# For livereload in webapp/test/localhost.[cert|key]

openssl x509 -inform der -in localhost.der -out livereload.cer
mv livereload.cer ../../war/src/main/webapp
rm localhost.der

keytool -importkeystore \
  -srckeystore keystore.jks \
  -storepass password \
  -destkeystore localhost.p12 \
  -deststoretype PKCS12
openssl pkcs12 -in localhost.p12  -nodes -nocerts -out livereload.key
mv livereload.key ../../war/src/main/webapp
rm localhost.p12