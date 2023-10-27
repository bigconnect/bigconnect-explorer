1. Build Graph Engine:
```shell
git clone https://github.com/bigconnect/bigconnect.git
mvn install -DskipTests
```

2. Build plugin-uri publice DataWorkers
```shell
git clone https://github.com/bigconnect/dataworker-plugins.git
mvn install -DskipTests
```

3. Build Explorer
```shell
git clone https://github.com/bigconnect/bigconnect-explorer.git
mvn install -DskipTests
```

4. Build Plugin-uri Explorer publice
```shell
git clone https://github.com/bigconnect/explorer-plugins.git
mvn install -DskipTests
```

5. Build docker image
```shell
mvn clean package

```

### Instructiuni Run & Debug
BigConnect Explorer impreuna cu plugin-urile dezvoltate aici se poate rula folosind IntelliJ IDEA.
Se creaza un nou Run configuration de tip Application, cu urmatoarele setari:

- Name: ```Explorer```
- Java: ```jdk11``` (versiuni diferite de 11 nu functioneaza)
- Classpath: ```web-release```
- Main class: ```com.mware.web.TomcatWebServer```
- Program arguments: --webAppDir ```<calea catre>/bigconnect-explorer/war/src/main/webapp``` --port 8888
- Working directory: ```$MODULE_DIR$```
- Environment variables: ```BIGCONNECT_DIR=$MODULE_DIR$/../..;GOOGLE_APPLICATION_CREDENTIALS=$MODULE_DIR$/../../config/bigconnect-um-f7289cd1202f.json```
