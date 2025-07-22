:: Startup --system
[settings]
	[start Funhouse Entrance ]
	[tsp_version `1.1.1`] 
	[app_version `1.0.0`] 
	[author `Pete Gardner`] 
	[title] Mystery Puzzle House
	[ifid `ABCDE12345`] 
	[subtitle] A short, selection-based mystery game demo.
	[description] This is an adaptation of Scott Adam's [i]Mystery Funhouse[/i] for demonstrating the capabilities of the TaleSpinner language.  It may contain some spoilers for the original game.
	[copyright] (c) 2024 Pete Gardner// Default: (c) {current year} {author} 
[/settings]


// LOCATIONS

:: Funhouse Entrance --location
I'm in front of the FUN HOUSE.

Obvious exit: [[Parking Lot `EAST`]]
Visible items: ^Sign^, ^Ticket Counter^

[scenery]
	[prop Sign]
		I see nothing special.
	[prop Ticket Counter]
		I see nothing special.
[/scenery]

:: Parking Lot -- location
I'm in a parking lot.

Obvious exit: [[Funhouse Entrance `WEST`]]
Visible items: ^Rusty closed grating^, ^dead tree^, [[five dollar bill]]

[scenery]
	[prop Rusty closed grating]
		I see a shiny coin at the bottom of the drain! Two big bolts hold it down.
	[prop dead tree]
		Only thing left is one bare branch.
[/scenery]

