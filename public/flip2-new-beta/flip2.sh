#!/bin/bash
echo "   __ _ _      ___        _      |                                     |"
echo "  / _| (_)    |__ \      | |     |             special thanks          |"
echo " | |_| |_ _ __   ) |  ___| |__   | neutronscott        Apps4Flip-Admin |"
echo " |  _| | | '_ \ / /  / __| '_ \  | darth                    Yiannis128 |"
echo " | | | | | |_) / /_ _\__ \ | | | | Biden2020Prez        EnriqueMcquade |"
echo " |_| |_|_| .__/____(_)___/_| |_| | darth                     topjohnwu |"
echo "         | |                     | bkerler                             |"
echo "         |_|      version 1.0.0  |                                     |"
echo "                by johnny stene  |                                     |"
echo ""

MAGISK=https://github.com/topjohnwu/Magisk/releases/download/v27.0/Magisk-v27.0.apk

WORKING_DIRECTORY=$(pwd)

magiskboot() {
	# Helper function to run libmagiskboot
	$WORKING_DIRECTORY/magisk/lib/x86_64/libmagiskboot.so "$@"
}

setup() {
	# Download all files needed to work with phone and patch images
	echo "Running setup..."

	if [ -e ".setup_complete" ]; then
		echo "Setup already completed - cleaning up old install and re-setting up..."
		rm -rf magisk mtkclient
	fi
	
	echo "Downloading Magisk..."
	wget $MAGISK

	echo "Extracting Magisk..."
	mkdir magisk
	cd magisk
	unzip -q ../Magisk-v27.0.apk
	chmod +x lib/x86_64/libmagiskboot.so
	cd $WORKING_DIRECTORY
	rm Magisk-v27.0.apk

	echo "Downloading mtkclient..."
	git clone https://github.com/bkerler/mtkclient

	echo "Extracting mtkclient and installing requirements..."
	mkdir mtkclient
	cd mtkclient
	unzip -q ../2.0.1.freeze.zip
	mv mtkclient-2.0.1.freeze/* ./
	python3 -m pip install -r requirements.txt
	cd $WORKING_DIRECTORY
	rm 2.0.1.freeze.zip
	rm -rf mtkclient/mtkclient-2.0.1.freeze

	echo "Installing mtk udev rules (this may prompt for your password)"
	sudo usermod -a -G plugdev $USER
	sudo usermod -a -G dialout $USER
	sudo cp Setup/Linux/* /etc/udev/rules.d
	sudo udevadm control -R
	sudo udevadm trigger
	
	# TODO: install packages from distro package manager for fastboot/platform-tools and mtkclient reqs
	
	cd $WORKING_DIRECTORY
	touch .setup_complete
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
		resize2fs system.img 1332M
		resize2fs vendor.img 256M
		resize2fs product.img 128M
		
		echo "Mounting partitions..."
		mkdir system vendor product
		sudo mount system.img system
		sudo mount vendor.img vendor
		sudo mount product.img product
		
		echo "Done. You may now modify the contents of the buildsuper/unpacked/<super,vendor,product> directories."
	else
		echo "You must take a backup first (we use the files here!)"
	fi
}

repacksuper() {
	# Unmount all partitions, shrink all partitions, and repack a new super.img (needs root)
	if [ -e "buildsuper" ]; then
		cd buildsuper/unpacked
	
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
		SUPER_SIZE=2147483648
		
		echo "System: $SYSTEM_SIZE, Vendor: $VENDOR_SIZE, Product: $PRODUCT_SIZE, Total: $TOTAL_SIZE"
		echo "Fits in partition of size $SUPER_SIZE"
		
		echo "Packing..."
		mkdir $WORKING_DIRECTORY/patched
		lpmake --metadata-size 65536 --super-name super --metadata-slots 1 \
			--device super:$SUPER_SIZE \
			--group main:$TOTAL_SIZE \
			--partition system:readonly:$SYSTEM_SIZE:main \
			--partition product:readonly:$PRODUCT_SIZE:main \
			--partition vendor:readonly:$VENDOR_SIZE:main \
			--image system=./system.img \
			--image vendor=./vendor.img \
			--image product=./product.img \
			--sparse --output $WORKING_DIRECTORY/patched/super.img
		
		echo "Done."
	else
		echo "You do not appear to have an unpacked super image open."
	fi
}

remountsuper() {
	# Remount partitions (needs root)
	if [ -e "buildsuper/unpacked" ]; then
		echo "Expanding partitions..."
		cd unpacked
		e2fsck -fy system.img
		e2fsck -fy vendor.img
		e2fsck -fy product.img
		resize2fs system.img 1332M
		resize2fs vendor.img 256M
		resize2fs product.img 128M
		
		echo "Mounting partitions..."
		mkdir system vendor product
		sudo mount system.img system
		sudo mount vendor.img vendor
		sudo mount product.img product
		
		echo "Done. You may now modify the contents of the buildsuper/unpacked/<super,vendor,product> directories."
	else
		echo "You don't seem to have in-progress files (buildsuper/unpacked)!"
	fi
}

installgsi() {
	# Unpack super.img, insert a GSI, and repack
	mkdir $WORKING_DIRECTORY/buildsuper
	cd $WORKING_DIRECTORY/buildsuper
	
	if [ -e "../backup/super.bin" ]; then
		echo "Unpacking super.bin..."
		cp ../backup/super.bin ./super.img
		mkdir unpacked
		lpunpack super.img unpacked
		cd unpacked
		
		echo "Inserting $3..."
		cp $3 ./system.img

		echo "Calculating sizes..."
		SYSTEM_SIZE=$(stat -c "%s" system.img)
		VENDOR_SIZE=$(stat -c "%s" vendor.img)
		PRODUCT_SIZE=$(stat -c "%s" product.img)
		TOTAL_SIZE=$(python3 -c "print($SYSTEM_SIZE + $VENDOR_SIZE + $PRODUCT_SIZE)")
		SUPER_SIZE=2147483648
		
		echo "System: $SYSTEM_SIZE, Vendor: $VENDOR_SIZE, Product: $PRODUCT_SIZE, Total: $TOTAL_SIZE"
		# TODO: check. we just guess on repacksuper because i don't let it get too big
		echo "Fits in partition of size $SUPER_SIZE"
		
		echo "Packing..."
		mkdir $WORKING_DIRECTORY/patched
		lpmake --metadata-size 65536 --super-name super --metadata-slots 1 \
			--device super:$SUPER_SIZE \
			--group main:$TOTAL_SIZE \
			--partition system:readonly:$SYSTEM_SIZE:main \
			--partition product:readonly:$PRODUCT_SIZE:main \
			--partition vendor:readonly:$VENDOR_SIZE:main \
			--image system=./system.img \
			--image vendor=./vendor.img \
			--image product=./product.img \
			--sparse --output $WORKING_DIRECTORY/patched/super.img
		
		echo "Done."
	else
		echo "You must take a backup first (we use the files here!)"
	fi
}

scripthelp() {
	# Print help
	echo "usage:"
	echo ""
	echo "$0 setup"
	echo "    Re-run setup"
	echo "$0 device [argument]"
	echo "    backup"
	echo "        Take a full backup of the device"
	echo "    restore"
	echo "        Restore the backup taken"
	echo "    flashing-unlock"
	echo "        Unlock device for flashing without wiping data"
	echo "    fastboot"
	echo "        Put device in fastboot"
	echo "$0 super [argument]"
	echo "    unpack"
	echo "        Unpack and mount super.img partitions for modification"
	echo "    repack"
	echo "        Unmount and pack a new super.img"
	echo "    remount"
	echo "        Re-mount partitions without replacing them with backed up ones"
	echo "    flash"
	echo "        Flash new super.img to the device"
	echo "    install-gsi [file]"
	echo "        Unpack super, replace system.img with [file], and repack"
	echo "$0 boot [argument]"
	echo "    patch"
	echo "        Patch boot.img to enable root"
	echo "    flash"
	echo "        Flash new boot.img to the device"
}

if [ -e ".setup_complete" ]; then
	if [ "$1" == "setup" ]; then
		setup
	elif [ "$1" == "super" ]; then
		if [ "$2" == "unpack" ]; then
			unpacksuper
		elif [ "$2" == "repack" ]; then
			repacksuper
		elif [ "$2" == "remount" ]; then
			remountsuper
		elif [ "$2" == "flash" ]; then
			python3 mtkclient/mtk.py payload --metamode FASTBOOT
			fastboot flash super patched/super.img
			fastboot reboot
		elif [ "$2" == "install-gsi" ]; then
			installgsi
		fi
	elif [ "$1" == "boot" ]; then
		if [ "$2" == "patch" ]; then
			buildboot
		elif [ "$2" == "flash" ]; then
			python3 mtkclient/mtk.py payload --metamode FASTBOOT
			fastboot flash boot patched/boot.img
			fastboot reboot
		fi
	elif [ "$1" == "device" ]; then
		if [ "$2" == "backup" ]; then
			backup
		elif [ "$2" == "restore" ]; then
			restore
		elif [ "$2" == "flashing-unlock" ]; then
			python3 mtkclient/mtk.py da seccfg unlock
			echo "==========================="
			echo "   RECONNECT DEVICE NOW!"
			echo "==========================="
			python3 mtkclient/mtk.py payload --metamode FASTBOOT
			fastboot flash vbmeta backup/vbmeta.bin --disable-verity --disable-verification
			fastboot flash vbmeta_vendor backup/vbmeta_vendor.bin --disable-verity --disable-verification
			fastboot flash vbmeta_system backup/vbmeta_system.bin --disable-verity --disable-verification
		elif [ "$2" == "fastboot" ]; then
			python3 mtkclient/mtk.py payload --metamode FASTBOOT
		fi
	else
		scripthelp
	fi
else
	setup
fi
