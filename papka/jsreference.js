//Chapter 1: Values, Types, Operators
//console.log("good luck");
//Numbers
//64 bits for numbers 2^64

//Arithmetic
//Unary operators
//typeof() - returns type of variable
//<cond> ? iftrue : iffalse

//type coercion - converts "wrong" types automatically, always sends a result no matter the expression
//8 * null = 0; "5" - 1 = 4; "five" * 2 = NaN; false == 0 = true
//!!!null == undefined = true; null == 0 = false


//Chapter 2:Program structure

//expression - a fragment of code that produces a value
let caught = 5 * 5; //variable
let nothing; //undefined
//function - Number() ; converts to number

//conditions:
//if - same as c#
//while - same as c#
//do while - same
//for - same

function zadChess()
{
    for (let i = 0; i < 8; i++)
    {
        if (i % 2 == 0)
            console.log(" # # # #");
        if (i % 2 != 0)
            console.log("# # # # ");
    }
}


//Chapter 3: Functions

//vars are global
//let, const are locals
/*function syntax
    const <name> = function(<args1>...<argsN) {
        <code>
    };*/

/*regular notation
    function <name>(<args>){
        <code>
    }*/
/*arrow notation
    const <name> = (<args>) => {
            <code>
        }
    
for one arg:
    const <name> = <arg> => <code>; */

//functions can pass any number of arguments, even if we doesn't set them

//

