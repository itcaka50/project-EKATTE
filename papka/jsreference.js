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

//Chapter 4: Data structures

//array
let list = [1, 2, 3, 4];
//push,pop
//includes
//shift, unshift(dobavq)
//slice
//object
//concat

let Jacques = {
    squirrel: false,
    events: ["sleep", "sleep"]
};

delete Jacques.squirrel;

//correlation
function phi(table) {
  return (table[3] * table[0] - table[2] * table[1]) /
    Math.sqrt((table[2] + table[3]) *
              (table[0] + table[1]) *
              (table[1] + table[3]) *
              (table[0] + table[2]));
}
//probabilities


//for (let entry of array) - foreach

//strings
//trim
//padStart(<how much>, <with what>)
//split, join
//repeat(<times>)

//function f(...n) any number of arguments, acts as an array of arguments
//works in arrays if you add [a, b, c, ...<arrayname>]

//JSON- jsobjnotation
/*
{
    <"name"> : <value>,
}
*/

//JSON.stringify,JSON.parse

//Chapter 5: Higher-order functions

//we put functions in arguments to abstract them

//filter, map, reduce

//Chapter 6: The Secret Life Of Objects


//prototypes

//classes
//private properties use #

//class Map for maps
//Symbol

//inheritance - extends super/sub class
//instanceof


//Chapter 8: Bugs and errors

"use strict";

function test(label, body){
    if (!body()) console.log('Failed: ${label}');
}

test("convert Latin to uppercase", () => {
    return "hello".toUpperCase() == "HELLO";
});

if (true == false)
    throw new Error("Mistake");

//Chapter 9: REGEX


let reg1 = new RegExp("abc");
let reg2 = /abc/;

//some characters are special in regex and if used as symbols must be placed with a '\'

//brackets for matching any values:

/[0123456789]/;
/[0-9]/;

/*
\d	Any digit character
\w	An alphanumeric character (“word character”)
\s	Any whitespace character (space, tab, newline, and similar)
\D	A character that is not a digit
\W	A nonalphanumeric character
\S	A nonwhitespace character
\u unicode
.	Any character except for newline */

let dateTime = /\d\d-\d\d-\d\d\d\d \d\d:\d\d/;

//if you want to match any char except some, use: '^'

let avoid = /[^01]/;

// \p is used to match all chars from the unicode standart

/*
\p{L}	Any letter
\p{N}	Any numeric character
\p{P}	Any punctuation character
\P{L}	Any nonletter (uppercase P inverts)
\p{Script=Hangul}	Any character from the given script
*/

//+ indicates that the element may be repeated more than once
//* allows the pattern to match 0 times
//? makes the prev part of the pattern optional
//{} brackets are used when a pattern must occur a precise number of times
//| denotes a choice (a|b|c|d)

//.search(regex) -> indexof regex
//replace -> works with regex on strings

//Chapter 10: Modules

//import, export

//export in front a func to make in importable by other modules

//import {<names>} from <filepath>;

//import * as <smth> from <file>

//Chapter 11: ASynchronous Programming

//Class Promise, then func

let fifteen = Promise.resolve(15);
fifteen.then(value => console.log(`Got ${value}`));

function textFile(filename) {
  return new Promise(resolve => {
    readTextFile(filename, text => resolve(text));
  });
}

textFile("plans.txt").then(console.log);

function randomFile(listFile) {
  return textFile(listFile)
    .then(content => content.trim().split("\n"))
    .then(ls => ls[Math.floor(Math.random() * ls.length)])
    .then(filename => textFile(filename));
}

/*
someAsyncFunction((error, value) => {
  if (error) handleError(error);
  else processValue(value);
});*/ //error handling

//async, await

//generator functions, yield keyword: function*

//promise.all - for array of promises