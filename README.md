# Angluin Simulation

### General
This tool can learn a regular language, where the user has to answer membership queries and conjectures.  
The alphabet can be changed in the `config.js`.  
Click on the table and fill it using `0` and `1` on the keyboard. Whenever the table is not closed or not consistent, it will be shown in the top right.  
To fix this, simply press the `Apply` button.  
Whenever the DFA occurs, drag the nodes and transitions around to make the visuals more appealing. If the language of the DFA is the one the user has in mind, the simulation is done. Otherwise, provide a counterexample of the symmetric difference and continue.

### Getting started
In order to run the code, a (local) server needs to be used, since otherwise browsers won't allow the imports in the code for security reasons.  
For me, the most simple method is to use the `Live-Server Extension` from Visual Studio Code.