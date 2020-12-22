
Linux
-----

```bash
keytool -importkeystore -srckeystore keystore.jks -destkeystore keystore.p12 -srcalias bigconnect -srcstoretype jks -deststoretype pkcs12
# password is password
openssl pkcs12 -in keystore.p12 -out keystore.pem
certutil -d sql:$HOME/.pki/nssdb -A -t "P,," -n bigconnect -i keystore.pem
```

completely restart Chrome

