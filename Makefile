# Reminder Pro Makefile

UUID = remindme@user.github.io
SCHEMA = org.gnome.shell.extensions.remindme.gschema.xml
EXTENSION_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all clean install pack

all: schemas/$(SCHEMA).compiled

schemas/$(SCHEMA).compiled: schemas/$(SCHEMA)
	glib-compile-schemas schemas/

install: all
	mkdir -p $(EXTENSION_PATH)
	cp -r * $(EXTENSION_PATH)/
	# Don't copy the Makefile or schemas source to the installation dir if preferred
	# But for simplicity we'll copy everything and then clean up or just leave it
	@echo "Extension installed to $(EXTENSION_PATH). Restart GNOME Shell to apply changes."

pack: all
	gnome-extensions pack --force --out-dir=./build/

clean:
	rm -f schemas/*.compiled
	rm -rf build/
