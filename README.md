What it does:

It would pack all selected files  in VS Code tree, and merge into one, annotating  sources with paths and file names. 
This is useful if you need LLM to get understanding of several files in your project.
For a small project and LLM with big context window you can make LLM aware of your whole project.

For a bigger project you can select file that you really want to modify and some neighbor files that might be crucial for LLM to understand how make changes.


To install:

copy pack-for-llm-js folder to
%USERPROFILE%\.vscode\extensions



To use:

 in file tree select files you want to pack, right click on one of the selected files and do  "Pack for LLM" menu item.
You can select folders as well, in this case all the content would be packed as well


Tested at:

* Windows 11
* VS Code 1.98.0  ( latest per 08-Mar-25)



