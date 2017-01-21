## Lapiz Testing
This is a testing library that is part of the Lapiz suite. It is a stand-alone library and does not require Lapiz to run. It's included here because it was developed to test Lapiz.

This library has a few unique features. First, it is a library not a framework. Your tests are passed in and you invoke the main test call. The other unique feature is dependency hierarchies. This allows you to define that one test depends on another test. This was required because Lapiz builds on itself. If the events module is broken, every other test will fail. It's much easier to fix the cascade of failures if you only see the roots of the failure, rather than the whole cascade.

This library was inspired largely by the Go testing framework and should be used in a similar fashion.

### Writing a Test
Defining a test has 2 or 3 arguments.

The first argument is the name of the test. Namespaces can be defined with slashes, for instance "Dictionary/Delete" the the "Delete" test in the "Dictionary" namespace. This can be helpful when defining testing dependencies.

The last argument is test function. A Testing object will be passed into the test. See below for more details on the Testing object.

The optional middle argument is an array of dependencies. The array should contain only strings. A dependency of "Dictionary/Delete" depends on only that test. A dependency of "Dictionary/" depends on all tests in the Dictionary namespace. Be careful because a test of "Dictionary" depends on only a test named "Dictionary" in the root namespace.

### UI
The UI script will automatically run all defined tests and make the body of the html document the results.

### ToDo
* benchmarking
* add a way to define a namespace level dependency
* in UI, move sub-groups to bottom (currently, they get interspersed)

It could look nicer. I would like to collect more data at some point, better traces, run-times. It would also be nice to be able to change the display settings, choosing what to show.

I would like some way to test UI stuff
