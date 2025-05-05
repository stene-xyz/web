#!/bin/bash
echo "flip2.sh"
echo "version 1.0"
echo "original script by neutronscott (github:neutronscott/flip2)"
echo "modified by johnny stene (johnny@stene.xyz)"
echo ""
echo "https://stene.xyz/flip2"
echo "----"

# TODO: more credits

MTKCLIENT=https://github.com/bkerler/mtkclient/archive/refs/tags/2.0.1.freeze.zip
MAGISK=https://github.com/topjohnwu/Magisk/releases/download/v27.0/Magisk-v27.0.apk

WORKING_DIRECTORY=$(pwd)

magiskboot() {
	# Helper function to run libmagiskboot
	$WORKING_DIRECTORY/magisk/lib/x86_64/libmagiskboot.so "$@"
}

setup() {
	# Download all files needed to work with phone and patch images
	echo "Running setup..."
	
	echo "Downloading Magisk..."
	wget $MAGISK

	echo "Extracting Magisk..."
	mkdir magisk
	cd magisk
	unzip -q ../Magisk-v27.0.apk
	chmod +x lib/x86_64/libmagiskboot.so
	cd $WORKING_DIRECTORY

	echo "Downloading mtkclient..."
	wget $MTKCLIENT

	echo "Extracting mtkclient and installing requirements..."
	mkdir mtkclient
	cd mtkclient
	unzip -q ../2.0.1.freeze.zip
	python3 -m pip install -r requirements.txt
	cd $WORKING_DIRECTORY

	echo "Installing mtk udev rules (this may prompt for your password)"
	sudo usermod -a -G plugdev $USER
	sudo usermod -a -G dialout $USER
	sudo cp Setup/Linux/* /etc/udev/rules.d
	sudo udevadm control -R
	sudo udevadm trigger
	
	# TODO: install packages from distro package manager for fastboot/platform-tools and mtkclient reqs
	
	echo "You will need to reboot your system for changes to take effect."
}

backup() {
	# Save all partitions
	echo "Backing up, this will take a bit..."
	
	mkdir -p backup
	python3 $WORKING_DIRECTORY/mtkclient/mtk.py rl backup

	echo "Done."
}

restore() {
	# Restore all partitions
	echo "Restoring, this will take a bit..."
	
	python3 $WORKING_DIRECTORY/mtkclient/mtk.py wl backup
	
	echo "Done."
}

buildboot() {
	# Build a patched boot.img
	echo "Preparing to build..."
	rm -rf buildboot
	mkdir -p buildboot
	cd buildboot
	
	if [ -e "../backup" ]; then
		echo "Unpacking..."
		cp ../backup/boot.bin ./boot.img
		mkdir boot
		cd boot
		magiskboot unpack ../boot.img
		mkdir ramdisk
		cd ramdisk
		magiskboot cpio ../ramdisk.cpio extract
		cd ../../
		
		echo "Patching..."
		cp -r boot patched-boot
		cd patched-boot/ramdisk
		mkdir overlay.d
		cd overlay.d
		echo "on post-fs-data\nexec u:r:magisk:s0 root root -- \${MAGISKTMP}/magisk resetprop -n ro.vendor.tct.endurance true" >> init.custom.rc
		mkdir sbin
		mkdir .backup
		magiskboot compress=xz $WORKING_DIRECTORY/magisk/lib/armeabi-v7a/libmagisk32.so $WORKING_DIRECTORY/patched-boot/ramdisk/overlay.d/sbin/magisk32.xz
		magiskboot compress=xz $WORKING_DIRECTORY/magisk/assets/stub.apk $WORKING_DIRECTORY/patched-boot/ramdisk/overlay.d/sbin/stub.xz
		magiskboot compress=xz $WORKING_DIRECTORY/patched-boot/ramdisk/init $WORKING_DIRECTORY/patched-boot/ramdisk/.backup/init.xz
		cp $WORKING_DIRECTORY/magisk/lib/armeabi-v7a/libmagiskinit.so $WORKING_DIRECTORY/patched-boot/ramdisk/init
		SHA1=$(magiskboot sha1 $WORKING_DIRECTORY/buildboot/boot.img)
		echo "KEEPVERITY=true\nKEEPFORCEENCRYPT=true\nRECOVERYMODE=false\nPREINITDEVICE=cache\nSHA1=$SHA1" >> .backup/.magisk
		echo "overlay.d\0overlay.d/sbin\0/overlay.d/sbin/magisk32.xz\0overlay.d/sbin/stub.xz" >> .backup/.rmlist
		magiskboot cpio ramdisk.cpio \
			'mkdir 700 .backup' \
			'add 400 .backup/.magisk ramdisk/.backup/.magisk' \
			'add 400 .backup/.rmlist ramdisk/.backup/.rmlist' \
			'add 750 .backup/init.xz ramdisk/.backup/init.xz' \
			'mkdir 750 overlay.d' \
			'mkdir 750 overlay.d/sbin' \
			'add 700 overlay.d/init.custom.rc ramdisk/overlay.d/init.custom.rc' \
			'add 744 overlay.d/sbin/magisk32.xz ramdisk/overlay.d/sbin/magisk32.xz' \
			'add 744 overlay.d/sbin/stub.xz ramdisk/overlay.d/sbin/stub.xz' \
			'add 750 init ramdisk/init' \
			patch
		magiskboot cpio ramdisk.cpio 'ls / -r'
		
		echo "Rebuilding..."
		mkdir $WORKING_DIRECTORY/patched
		magiskboot repack $WORKING_DIRECTORY/buildboot/boot.img
		cp $WORKING_DIRECTORY/new-boot.img $WORKING_DIRECTORY/patched/boot.img
		
		echo "Done."
	else
		echo "You must take a backup first (we use the files here!)"
	fi
	
}

unpacksuper() {
	# Unpack super.img, expand all partitions, and mount partitions (needs root)
	mkdir $WORKING_DIRECTORY/buildsuper
	cd $WORKING_DIRECTORY/buildsuper
	
	if [ -e "../backup/super.bin" ]; then
		echo "Unpacking super.bin..."
		cp ../backup/super.bin ./super.img
		mkdir unpacked
		lpunpack super.img unpacked
		
		echo "Expanding partitions..."
		cd unpacked
		e2fsck -fy system.img
		e2fsck -fy vendor.img
		e2fsck -fy product.img
		# TODO: figure out good sizes
		#resize2fs system.img 0M
		#resize2fs vendor.img 0M
		#resize2fs product.img 0M
		
		echo "Mounting partitions..."
		mkdir system vendor product
		sudo mount system.img system
		sudo mount vendor.img vendor
		sudo mount product.img product
		
		echo "Done."
	else
		echo "You must take a backup first (we use the files here!)"
	fi
}

repacksuper() {
	# Unmount all partitions, shrink all partitions, and repack a new super.img (needs root)
	if [ -e "unpacked" ]; then
		echo "Unmounting partitions..."
		sudo umount system.img
		sudo umount vendor.img
		sudo umount product.img
		
		echo "Resizing partitions..."
		# fsck before and after just in case resize2fs messes things up
		e2fsck -fy system.img
		e2fsck -fy vendor.img
		e2fsck -fy product.img
		resize2fs -M system.img
		resize2fs -M product.img
		resize2fs -M vendor.img
		e2fsck -fy system.img
		e2fsck -fy vendor.img
		e2fsck -fy product.img
		
		echo "Calculating sizes..."
		SYSTEM_SIZE=$(stat -c "%s" system.img)
		VENDOR_SIZE=$(stat -c "%s" vendor.img)
		PRODUCT_SIZE=$(stat -c "%s" product.img)
		TOTAL_SIZE=$(python3 -c "print($SYSTEM_SIZE + $VENDOR_SIZE + $PRODUCT_SIZE)")
		# TODO: get actual super.bin size
		SUPER_SIZE=0
		
		echo "System: $SYSTEM_SIZE, Vendor: $VENDOR_SIZE, Product: $PRODUCT_SIZE, Total: $TOTAL_SIZE"
		echo "Fits in partition of size $SUPER_SIZE"
		
		# TODO: lpmake command from notes
		#lpmake
	else
		echo "You do not appear to have an unpacked super image open."
	fi
}

scripthelp() {
	# Print help
	echo "usage: $0 [setup/backup/restore/buildboot/unpacksuper/repacksuper/help]"
}

# TODO: make this follow:
# flip2.sh [option]
#	setup
#	device
#		backup
#		restore
#	boot
#		unpack
#		repack
#		autopatch
#	super
#		unpack
#		repack
#		mount
#		unmount
if [ "$1" == "setup" ]; then
	setup
elif ["$1" == "backup" ]; then
	backup
elif [ "$1" == "restore" ]; then
	restore
elif [ "$1" == "buildboot" ]; then
	buildboot
elif [ "$1" == "unpacksuper" ]; then
	unpacksuper
elif [ "$1" == "repacksuper"]; then
	repacksuper
else
	scripthelp
fi
