// Command productivity-dmg builds the drag-and-drop macOS installer.
package main

import (
	"fmt"
	"os"

	"github.com/leaanthony/dmg/dmg"
)

func main() {
	if len(os.Args) != 3 {
		fmt.Fprintln(os.Stderr, "Usage: productivity-dmg <Productivity.app> <output.dmg>")
		os.Exit(2)
	}
	options := dmg.Options{
		VolumeName:             "Productivity",
		OutputPath:             os.Args[2],
		Files:                  map[string]string{"Productivity.app": os.Args[1]},
		AddApplicationsSymlink: true,
		IconPositions: map[string]dmg.IconPosition{
			"Productivity.app": {X: 150, Y: 130},
			"Applications":     {X: 390, Y: 130},
		},
	}
	if err := dmg.Build(options); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
