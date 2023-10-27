if [ -z "$BDL_DIR" ]
then
  export BDL_DIR="/opt/bdl"
fi

export BDL_HOME=$BDL_DIR
export BDL_DATA_DIR="$BDL_DIR/data"
export BDL_LOG_DIR="$BDL_DIR/log"
export BDL_CONF_DIR="$BDL_DIR/etc"

export PATH=$JAVA_HOME/bin:$PATH

# BigConnect
export EXPLORER_DIR="$BDL_DIR/lib/explorer"
export EXPLORER_DATA_DIR="$EXPLORER_DIR/datastore"

# Force default locale
export LC_ALL=en_US.UTF-8

# Raise default ulimits to more reasonable values
ulimit -Sn hard
ulimit -Su hard

# create data and log folders if they don't exist
data_folders=( "explorer" "explorer/datastore" "explorer/tmp" )
for df in "${data_folders[@]}"
do
	if [ ! -d $BDL_DIR/data/$df ] ; then
		mkdir -p $BDL_DIR/data/$df
	fi
done
