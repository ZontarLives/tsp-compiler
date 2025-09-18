# Todo Items

### Nov 17, 2023

- [x] Ensure entityRef generates the right code
- [x] Validate the Scenery ids for the current location
  - `[prop book] It's a strange lookin book.`
- [X] Implement Runtime Settings for macro instances using ":" to indicate the start of a settings list.
  - This will follow the same syntax as States in Entity Parameters. Details:
    - Code example:
      - `[chain : hidelinks]` 
    - If a setting exists but is not referenced in the macro, it will default to `false` or `off`.
    - Adding the setting alone will set it to `true` or `on`.
    - Assignment is possible:
      - `[chain : hidelinks = true]`
    - This works for numerical or string settings:
      - `[chain : count = 1]`
      - `[chain : monster = "Gronk"]`
    - Multiple settings are separated by commas:
      - `[chain : hidelinks, count = 1]`
  - Undetermined:
    - Can setting keys be composed of multiple words?
      - `[chain : monster name = "Gronk"]`
      - `[chain : monster name = "Gronk", monster type = "Orc"]`
      - [x] Yes, this is okay.
- [X] Single line comments at start of line with macro after it do not highlight in editor
- [X] Implement the `::Startup --system` entity containing a singular `settings` command containing:
  - [X] Start location: {entity location} (default: {entity location})
  - [X] IFID: {generated IFID string}
  - [X] TSP Version: {version number}
  - [X] App Version: {version number}
  - [X] Author: {author name}
  - [X] Title: {title}
  - [X] Subtitle: {subtitle}
  - [X] Description: {description}
  - [X] Language: {language}
    - [X] Note these are all optional and also must be singular, as is the --system entity.
    - [X] User Verification to ensure singularity in the settings and in the entity
- [X] Turn "Invalid property: ID" into a warning instead of an error, and auto-remove it in the output.
- [X] Add 'has been' and 'has not been' to the list of relational operators for booleans
- [X] In Editor, implement reserved keywords like [present, here, carried, handled, visited, encountered, met] etc. for entity properties
- 
- [ ] In parser, implement reserved keywords like parameterless functions.  
  - [Out of Scope] Set it  us so that the user can create their own.

- [ ] Time to face it: Need to typecast cmdDef.rval.
  - [ ] Need to typecast cmdDef.rval to a string, number, boolean or entity reference during [init].
  - [ ] Add def.rtype to the CommandDefinition object.  It can take the values: string, number, boolean, entity or any (for all four).
  - [ ] Must also keep record of that type in the Command object for intelligent type checking during runtime.

- [X] Devise system of declaring global variables:
  - [X] Declaration is: [init var to value] 
  - [X] Can be declared anywhere, Parser will hoist them to global space.
  - [X] Parser will log them and verify they are unique.
  - Out Of Scope:
    - [ ] Also devise system of local variables within an entity scope.
    - [ ] And also variables within the file scope?
 
- [X] Implement commands with sub-commands in the :settings group: 
  - [play dark_streets], 
  - [stop dark_streets : fade = 500], 
  - [pause dark_streets : fade = 500],
  - [resume dark_streets : fade = 1000],
  - [play darkStreets : loop; volume = 0.5]
    - [X] This will require allowing assignment to a setting in the normal `settings` pattern.
    - [ ] The Parser should only allow assignment to settings that are declared to receive assignments. (They are lvals and the assignment values are rvals)
    - [X]  Valid settings may need to be declared as part of the specific macro (like 'audio', in the above example.)
      - [ ] If so, there may need to be certain `global` settings that could apply to any macro, and/or be ignored if there is no application.  (More flexible, but could lead to errors.)
    - [ ] This brings up the possibility that we may need to introduce a STRING pattern for string assignments.  It should use double-quotes to distingush it from an `inline` pattern.

- [X] Entity parameter lexer sometimes tokenizes the value of a parameter as a word instead of a phrase.
  - [X] Add a KEYWORD pattern to help cover this
  - [ ] Need to test for the rest of the word/phrase/paragraph patterns

#### Entity Properties
- [ ] Add support for entity properties: Randal is here, etc.  But what about [set Randal.spoken to true] / (Randal has spoken) ?
  - Could one solution for boolean values be, instead of [set Randal.spoken to true], use [Randal is now spoken]?
  - How would this work for non-boolean properties?  [Randal.sneezecount is now 5]?  or [Randal's sneezecount is now 5]? Or [set Randal's sneezecount to 5]?
  - A common solution would require dot notation:
    - Assignment:
      - Boolean:     [set Randal.spoken to true]
      - Non-boolean: [set Randal.sneezecount to 5]
    - Conditional:
      - Boolean:     (Randal.spoken is true)
      - Non-boolean: (Randal.sneezecount is 5)


## Bugs
- [X] In a structured macro body, if there is another structured macro in that body that starts and ends with no option macros, like [if], then when the macro end for [/if] is encountered, it mistakes that for the end of the parent structured macro.
- [X] If I comment out the beginning [step]s in an [each] macro, and continue with a step after the comment, it does not recognize the step after the comment.

## Out of Scope
- [X] Process text so that [.?!] and [.", ?", !"] replace following whitespace (not newlines) with a HTML &emsp.
  - Decided to do this in the renderer instead of the parser
    ->  [ ] Consider changing entity parameter format to delimit with a comma instead of a pipe '|', and use semicolons instead of commas for the `state` parameter.

## Client Features

#### Conditional expressions
- [X] Topic references need a similar declaration system as entity references
  - [X] The [topic id] syntax should be used to declare a topic
  - [X] See how [prop id] is used to declare a property
  - [Solved by turning the topic id into a topic inlineText property]
- [ ] Testing values in conditionals:
  - Might need to declare data types for boolean, string, and number
    - Using >, <, >=, <=, etc. would require the data type to be a number
    - Using is, is not, etc. would require the data type to be a string or a number or a boolean
    - Should I simplify by just using JavaScript rules?
      - Strings evaluate to numbers and any math relative operators work on them?
      - Or would that become confusing to an author/non-programmer?

- [ ] The [each] command need not have a [step] command if it has a [loop] or [hold].  Make them all optional and issue a warning if the command is empty.

#### Newlines and Whitespace
- [ ] Add a setting to the editor to allow the user to choose whether or not to add a newline after a macro.

#### Newlines and Whitespace
- [X] Don't add newline macros if there is only one between the end of text and the start of a macro.
- [X] Consider keeping whitespace between the end of text and the beginning of a macro
- [X] The parser must decide whether or not to add a `newline` text macro to a `body`.
  - If there is a single newline at the end of a macro, it should be ignored.
  - If there are multiple newlines at the end of a macro, they should be reduced to a double newline.
  - Newlines between Structured Macro Options, should all be ignored, unless there are multiple newlines, in which case they should be reduced to a double newline.  (maybe same code as above?)
- Trying to add `flow:true` to the command defintion.  If it is not true, don't add newlines at all.  If it is true, perform smart newline processing in the Verify.reduceNewlines functions.

### BUGs
- [X] Lexer misidentifies a string as an attribute assignment, for example: (value: This is a string), when one of the words in that string is a reserved keyword.
   - [X] Need to create another pattern for strings that accepts keywords.  This will be for variable assignment only.
   - [X] This will produce a type called TOKEN_STRING, again, used specifically for variable assignment.

### Case Sensitivity

- [X] Deal with case sensitivity.  Every Entity ID and command Tag and command type, anything referenced by the user, will be set to lowercase.  In the case of IDs that are displayed or coded with capital letters, that will be copied to the `displayName` of the compiled object.  The `displayName` will be used for display purposes only.  The `id` will be used for all other purposes.

### Other


- [X]  Must add a generated unique ID to every Command, not just state based entities.  Entity IDs will remain as they are, but generated Command IDs will be unique.  They will become a UID field for every Command.
- [ ] With certain commands that belong to a parent Entity (as `Actions` belongs to and `Item`, if the user enters more than one block, perform some wizardry in Verification to merge the two of more blocks into one.
- [X] Verify the `set` command so that it understands whether or not its working with a boolean, string, number or entity reference.  Prevent the user from setting a string to a number, a boolean to a string, etc.
- [X] Need to remove spaces or tabs after a newline if there is nothing else on the line.  Similar to removing Comments.
- [ ] Investigate why a user-entered space is removed after a ^scene^ macro command.
- [X] Get &enspc; into the system.

- [ ] Create a structured command that will allow the user to build a modal menu. It will consist of some text (perhaps body text) and be followed by a list of selections.
- [ ] It may also be time to make option commands ununique and attached to the parent structural macro.

[itemselect Soft chewing gum `Stick Gum`]

  [intro]
    What do you want to stick the gum to?
  
  [choice branch]
    You stick it to the chair.
    [move soft chewing gum to offstage]
    [move branch with gum to player]
  
  [default]
    That doesn't work.

[/itemselect]

^^ This may require presenting a list of all carried, present and scenery items to the user.
Only items that cause a change when selected need to be coded.

- [ ] Verify there are no more than one prop option of the same name for a scenery command.

### BUGS
- [ ] The [chain] command did not catch that it was lacking an [intro] option command. It should have thrown an error at compile time.
- [ ] Problem with adding option commands to structured macros: If an incorrect option command is added, the compiler does not know that it is incorrect, as it could be another command within the option body.  One possible solution (messy) is to insert 'option' into each option macro, like [option prop weathered rooftops]



CLAUDE

- [X] There is a missing feature in the Parser class for compiling Npc entities.  The Npc source lexes propery (I think), but there appears to be no complimentary code in the Parser.  For background, the Npc definition will work much like the Scenerylink definition, except where the Scenerylink is delimited with '^...^', the Npc is delimited with '~....~'.

  Please review the code and create a markdown report named "NpcParserFixes.md".  Append that with a full technical design proposing how this feature can be fixed/added.  Think hard.

#Whitespace

In E:\Dev\TaleSpinner 2024\tsp-compiler\src\Verification.ts, line 859, there is a function named `static reduceStructuralWhitespaceAll()`.  This functions goal is to reduce unneeded whitespace from inside commands of `type: macro` and `flow: flow.structured`.  This was intended to make the text output from an Entity only include text and newlines that are intended to be output to the view.

The problem with the current method is that it is very special-case oriented and easy to break.  I want to replace this method with a new one named `manageWhitespace()`.  We will keep `reduceStructuralWhitespaceAll()` for backwards compatability, in case its needed, but that is doubtful.

The new `manageWhitespace()` function will properly observe a macro's `flow` property and manage its whitespace output based on that.  Take note that this will need to be a recursive system, as a macro's `flow` property may be different than that of its children.

For the purposes of this discussion, the term "whitespace" includes all spaces, tabs, newlines and other characters or entities that ouput spaces.

Here are the rules:

1. If a command type is `text`, it's body is nothing more than a string will always be rendered inline with surrounding text.
2. If a command has `flow: flow.inline`, then any output from its own (not childrens') body will keep all encountered whitespace.
3. If a command has `flow: flow.block`, then it is intended to be rendered as a separate block, or paragraph, of text.  It will preceed the body text with two newlines and terminate it with two newlines.  Any leading or ending whitespace in the body will be disregarded.
4. If a command has `flow: flow.structured`, then there will be no whitespace or even text output from its own body.  There may be child commands that output text, but they will be managed by their own `flow` properties.
5. If a command has `flow: flow.location`, this is a special case, where the Entity is a location that generates output intended to be displayed on the main view of the interpreter application, which is out of scope here.  This flow type trims any whitespace from before and after the initial render of the location.

The place where we manage this whitespace has been at the Verification time, after the Lexer has completed its operation on the entity.  Perform some research to determine whether or not there is a better way to manage this.

Read the E:\Dev\TaleSpinner 2024\tsp-compiler\src\Definitions.ts file.  With that information we will move on to examples.

Here is an example of source code:
```

:: Stately Library -- location
[once]
Welcome to the Demo Adventure, where we test out many of TaleSpinner's features.  This is a short, selection-based mystery game demo.  It is a work in progress.
[/once]

You are in a stately library.  It is a large room with a high ceiling and many bookshelves.  There is a ^large fireplace^ on the far wall, and a ^comfortable-looking chair^ in front of it.

There is a picture window on the wall to your left, letting in a soft light that illuminates the room.  On the wall to your right, there is a sturdy {wooden door}. [if (wooden door is not open)]It is presently closed.<else>It is presently open and leads to [[Study `the study`]].[/if]

A ~venerable sage~ is over there sitting in the corner of the room, reading a book.

An [[Foyer `arched doorway`]] leads to the foyer.  There is a [link `big presentation link here`][present]LINK![/present][/link]. There is also a [link `link that will rerender the location`][look][/link]

[scenery]
	<prop large fireplace>
		You see a large fireplace.  It is currently unlit.
	<prop comfortable-looking chair>  //Note: hyphens in scenery names work, but are incorrectly displayed as errors.
		You see a comfortable-looking chair.  It beckons you.
[/scenery]


```

The expected output from this is (if the wooden door is closed):
```
Welcome to the Demo Adventure, where we test out many of TaleSpinner's features.  This is a short, selection-based mystery game demo.  It is a work in progress.

You are in a stately library.  It is a large room with a high ceiling and many bookshelves.  There is a large fireplace on the far wall, and a comfortable-looking chair in front of it.

There is a picture window on the wall to your left, letting in a soft light that illuminates the room.  On the wall to your right, there is a sturdy wooden door. It is presently closed.

A venerable sage is over there sitting in the corner of the room, reading a book.

An arched doorway leads to the foyer.  There is a big presentation link here. There is also a link that will rerender the location

```

Note that there is to be no whitespace after the final text output "There is also a link that will rerender the location", as the `flow: flow.location` setting trims all white space at the end of the initial render.

The `scenery` command is `flow.structured`, and so does not output any whitespace of its own.  The two <prop> options are of type `flow.block`, and are rendered that way when they are executed.  In the case of `scenery`, they are rendered in modals, so are never displayed to the location view.

With this information I would like you to create a proposal as to how you would engineer this whitespace management.  Ask any questions you may need if there are logic or other types of gaps in my explanation of what I require.