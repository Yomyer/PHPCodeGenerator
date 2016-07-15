/*
 * Copyright (c) 2014 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, staruml, type, document, php7 */

define(function (require, exports, module) {
    "use strict";

    var Repository = app.getModule("core/Repository"),
        ProjectManager = app.getModule("engine/ProjectManager"),
        Engine = app.getModule("engine/Engine"),
        FileSystem = app.getModule("filesystem/FileSystem"),
        FileUtils = app.getModule("file/FileUtils"),
        Async = app.getModule("utils/Async"),
        UML = app.getModule("uml/UML");

    var CodeGenUtils = require("CodeGenUtils");

    //constante for separate namespace on code
    var SEPARATE_NAMESPACE = '\\';

    /**
     * PHP Code Generator
     * @constructor
     *
     * @param {type.UMLPackage} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    function PHPCodeGenerator(baseModel, basePath) {

        /** @member {type.Model} */
        this.baseModel = baseModel;

        /** @member {string} */
        this.basePath = basePath;

    }

    /**
     * Return Indent String based on options
     * @param {Object} options
     * @return {string}
     */
    PHPCodeGenerator.prototype.getIndentString = function (options) {
        if (options.useTab) {
            return "\t";
        } else {
            var i, len, indent = [];
            for (i = 0, len = options.indentSpaces; i < len; i++) {
                indent.push(" ");
            }
            return indent.join("");
        }
    };

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} path
     * @param {Object} options
     * @return {$.Promise}
     */
    PHPCodeGenerator.prototype.generate = function (elem, path, options) {
        var result = new $.Deferred(),
            self = this,
            fullPath,
            directory,
            codeWriter,
            file;

        // Package
        if (elem instanceof type.UMLPackage) {
            fullPath = path + "/" + elem.name;
            directory = FileSystem.getDirectoryForPath(fullPath);
            directory.create(function (err, stat) {
                if (!err) {
                    Async.doSequentially(
                        elem.ownedElements,
                        function (child) {
                            return self.generate(child, fullPath, options);
                        },
                        false
                    ).then(result.resolve, result.reject);
                } else {
                    result.reject(err);
                }
            });
        } else if (elem instanceof type.UMLClass) {

            // AnnotationType
            if (elem.stereotype === "annotationType") {
                fullPath = path + "/" + elem.name + ".php";
                codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
                codeWriter.writeLine("<?php\n");
                this.writePackageDeclaration(codeWriter, elem, options);
                codeWriter.writeLine();
                this.writeAnnotationType(codeWriter, elem, options);
                file = FileSystem.getFileForPath(fullPath);
                FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

                // Class
            } else {
                fullPath = path + "/" + elem.name + options.classExtension + ".php";
                codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
                codeWriter.writeLine("<?php\n");
                this.writePackageDeclaration(codeWriter, elem, options);
                codeWriter.writeLine();
                this.writeClass(codeWriter, elem, options);
                file = FileSystem.getFileForPath(fullPath);
                FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);
            }

            // Interface
        } else if (elem instanceof type.UMLInterface) {
            fullPath = path + "/" + elem.name + options.interfaceExtension + ".php";
            codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
            codeWriter.writeLine("<?php\n");
            this.writePackageDeclaration(codeWriter, elem, options);
            codeWriter.writeLine();
            this.writeInterface(codeWriter, elem, options);
            file = FileSystem.getFileForPath(fullPath);
            FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

            // Enum
        } else if (elem instanceof type.UMLEnumeration) {
            fullPath = path + "/" + elem.name + ".php";
            codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
            codeWriter.writeLine("<?php\n");
            this.writePackageDeclaration(codeWriter, elem, options);
            codeWriter.writeLine();
            this.writeEnum(codeWriter, elem, options);
            file = FileSystem.getFileForPath(fullPath);
            FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

            // Others (Nothing generated.)
        } else {
            result.resolve();
        }
        return result.promise();
    };


    /**
     * Return visibility
     * @param {type.Model} elem
     * @return {string}
     */
    PHPCodeGenerator.prototype.getVisibility = function (elem) {
        switch (elem.visibility) {
        case UML.VK_PACKAGE:
            return "";
        case UML.VK_PUBLIC:
            return "public";
        case UML.VK_PROTECTED:
            return "protected";
        case UML.VK_PRIVATE:
            return "private";
        }
        return null;
    };

    /**
     * Collect modifiers of a given element.
     * @param {type.Model} elem
     * @return {Array.<string>}
     */
    PHPCodeGenerator.prototype.getModifiersClass = function (elem) {
        var modifiers = [];

        if (elem.isStatic === true) {
            modifiers.push("static");
        }
        if (elem.isAbstract === true) {
            modifiers.push("abstract");
        }
        if (elem.isFinalSpecification === true || elem.isLeaf === true) {
            modifiers.push("final");
        }
        // transient
        // volatile
        // strictfp
        // const
        // native
        return modifiers;
    };
    /**
     * Collect modifiers of a given element.
     * @param {type.Model} elem
     * @return {Array.<string>}
     */
    PHPCodeGenerator.prototype.getModifiers = function (elem) {
        var modifiers = [];
        var visibility = this.getVisibility(elem);
        if (visibility) {
            modifiers.push(visibility);
        }
        var status = this.getModifiersClass(elem);
        return _.union(modifiers, status);
    };

    /**
     * Collect super classes of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    PHPCodeGenerator.prototype.getSuperClasses = function (elem) {
        var generalizations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLGeneralization && rel.source === elem);
        });

        _.map(this.getSterotipe(elem), function (st) {
            if(st.target.name.indexOf('extends ') >= 0){
                var extend = new type.UMLClass;
                extend.name = SEPARATE_NAMESPACE+st.target.name.split(" ").pop();
                extend.dontUse = 1;

                var generation = new type.UMLGeneralization;
                generation.target = extend;

                generalizations.push(generation);
            }

        });

        return _.map(generalizations, function (gen) {
            return gen.target;
        });
    };

    PHPCodeGenerator.prototype.getParamNamespace = function (elem) {
        var params = [];
        var returnParam = [];
        var _that = this;
        var namespaces = [];
        var namespace;

        // Auxiliar Methods
        for (var i = 0, len = elem.operations.length; i < len; i++) {
            params = elem.operations[i].getNonReturnParameters();
            returnParam = elem.operations[i].getReturnParameter();

            _.each(params, function (param) {
                if(namespace = _that.getAllTypes(param, 1))
                    namespaces.push(namespace);
            });

            if (returnParam) {
                if(namespace = _that.getAllTypes(returnParam, 1))
                    namespaces.push(namespace);
            }

        }

        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            for(var i in _implements){
                if(_implements[i] instanceof type.UMLInterface){
                    _.map(_implements[i].operations, function(operator){
                        params = operator.getNonReturnParameters();
                        returnParam = operator.getReturnParameter();

                        _.each(params, function (param) {
                            if(namespace = _that.getAllTypes(param, 1))
                                namespaces.push(namespace);
                        });

                        if (returnParam) {
                            if(namespace = _that.getAllTypes(returnParam, 1))
                                namespaces.push(namespace);
                        }
                    });
                }
            }
        }

        return namespaces;
    };

    PHPCodeGenerator.prototype.getAllTypes = function (elem) {
        var type = this.getType(elem, 1);
        var namespace = this.getType(elem, 1, 1);

        if(namespace.indexOf(SEPARATE_NAMESPACE) >= 0)
            return false;

        if(type.indexOf(SEPARATE_NAMESPACE) >= 0)
            return type.substring(1).replace('[]', '');

        return false;
    };
    /**
     * Collect super interfaces of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    PHPCodeGenerator.prototype.getSuperInterfaces = function (elem) {
        var realizations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLInterfaceRealization && rel.source === elem);
        });

        _.map(this.getSterotipe(elem), function (st) {
            if(st.target.name.indexOf('extends ') < 0)
                realizations.push(st);
        });

        return _.map(realizations, function (gen) {
            return gen.target;
        });
    };


    PHPCodeGenerator.prototype.getSterotipe = function (elem) {
        var interfaces = [];

        if(elem.stereotype && elem.stereotype.length > 0 )
            _.map(elem.stereotype.split(','), function(es){
                if(es != 'trait')
                    interfaces.push({target: {name: SEPARATE_NAMESPACE+es.trim()}});
            });

        return interfaces;
    };

    PHPCodeGenerator.prototype.getSuperDependencies = function (elem) {
        var dependencies = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLDependency && rel.source === elem && rel.target instanceof type.UMLClass);
        });

        return dependencies;
    };

    /**
     *
     * @param {type.Model} elem
     * @return {Array}
     */
    PHPCodeGenerator.prototype.getNamespaces = function (elem) {
        var _namespace = [];
        var _parent = [];
        if (elem._parent instanceof type.UMLPackage && !(elem._parent instanceof type.UMLModel)) {
            _namespace.push(elem._parent.name);
            _parent = this.getNamespaces(elem._parent);
        }
        return _.union(_parent, _namespace);
    };

    /**
     * Return type expression
     * @param {type.Model} elem
     * @return {string}
     */
    PHPCodeGenerator.prototype.getType = function (elem, document, withOutNamespace) {
        var _type = "void";
        var _namespace = "";
        var _document = ((typeof document) !== 'undefined' && document == 0) ? 0 : 1;

        if(elem == null){
            return _type;
        }

        // type name
        if (elem instanceof type.UMLAssociationEnd) {
            if (elem.reference instanceof type.UMLModelElement && elem.reference.name.length > 0) {
                _type = elem.reference.name;
				_namespace =_.map(this.getNamespaces (elem.reference), function (e) { return e; }).join(SEPARATE_NAMESPACE);

                if(_namespace!==""){
		    	    _namespace = SEPARATE_NAMESPACE+_namespace;
		        }
                 _type = _namespace + SEPARATE_NAMESPACE + _type;
            }
        } else {
            if (elem.type instanceof type.UMLModelElement && elem.type.name.length > 0) {
                _type = elem.type.name;
				_namespace =_.map(this.getNamespaces (elem.type), function (e) { return e; }).join(SEPARATE_NAMESPACE);

            if(_namespace!==""){
		    	_namespace = SEPARATE_NAMESPACE+_namespace;
		    }

            if(!withOutNamespace){
                _type = _namespace + SEPARATE_NAMESPACE + _type;
            }

            } else if (_.isString(elem.type) && elem.type.length > 0) {
                _type = elem.type;
            }
        }
        // multiplicity
        if (elem.multiplicity && _type !== "void") {
            if (_.contains(["0..*", "1..*", "*"], elem.multiplicity.trim())) {
                if (_document == 1) {
                    _type += "[]";
                } else {
                    _type = "array"
                }
            }
        }else{
            if (elem.defaultValue == '[]') {
                _type = "array"
            }
            if (_.contains(["0..*", "1..*", "*"], elem.multiplicity.trim())) {
                _type = "array"
            }
        }

        if(_type == "object")
            _type = "$this";

        return _type;
    };

    /**
     * Write Doc
     * @param {StringWriter} codeWriter
     * @param {string} text
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeDoc = function (codeWriter, text, options) {
        var i, len, lines, terms;
        if (options.phpDoc && _.isString(text)) {
            lines = text.trim().split("\n");
            codeWriter.writeLine("/**");
            for (i = 0, len = lines.length; i < len; i++) {
                terms = [" *"];
                if (lines[i] != "") {
                    terms.push(lines[i].trim());
                }
                codeWriter.writeLine(terms.join(" "));
            }
            codeWriter.writeLine(" */");
        }
    };

    /**
     * Write Spacification
     * @param {StringWriter} codeWriter
     * @param {string} text
     */
    PHPCodeGenerator.prototype.writeSpac = function (codeWriter, text) {
        var i, len, lines;
        if (_.isString(text)) {
            lines = text.trim().split("\n");
            for (i = 0, len = lines.length; i < len; i++) {
                codeWriter.writeLine(lines[i]);
            }
        }
    };

    var namespace=null;

    /**
     * Write Package Declaration
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writePackageDeclaration = function (codeWriter, elem, options) {
        var pathItems = [];
        this.namespace = null;
        pathItems = this.getNamespaces(elem);

        if (pathItems.length > 0) {
            //pathItems.push(elem.name);
            this.namespace = pathItems.join(SEPARATE_NAMESPACE);
        }
        if (this.namespace) {
            codeWriter.writeLine("namespace " + this.namespace + ";");
        }
    };

    /**
     * Write Use
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeUses = function (codeWriter, elem, options) {

        // Traits
        var mapping = [], mappings = '', uses = '', extra = ';';
        var _traits = this.getSuperDependencies(elem);
        if (_traits.length > 0) {

            uses = _.map(_traits, function (e) {
                if(e.mapping)
                    mapping.push(e.mapping);

                return e.target.name;
            }).join(", " + "\n\t\t");

            if(mapping.length){
                mappings = "{\n\t\t"+mapping.join(";\n\t\t")+";\n\t}";
                extra = '';
            }


            codeWriter.writeLine("use " + uses + extra + mappings);
        }
    };

    /**
     * Write Constructor
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeConstructor = function (codeWriter, elem, options) {
        var haveConstruct = false;
        var creates = [];

        for (var i = 0, len = elem.operations.length; i < len; i++) {
            if (elem.operations[i].name === "__construct") {
                haveConstruct = true;
            }
            if(elem.operations[i].name.search('createWith') >= 0){
                creates.push(elem.operations[i]);
            }
            ;
        }
        var _extends = this.getSuperClasses(elem);

        if (elem.name.length > 0 && _extends.length <= 0) {
            if (!haveConstruct) {
                var terms = [];
                // Doc
                this.writeDoc(codeWriter, elem.documentation, options);
                // Visibility
                var visibility = this.getVisibility(elem);
                if (visibility) {
                    terms.push(visibility);
                }
                terms.push("function __construct()");
                codeWriter.writeLine(terms.join(" "));
                codeWriter.writeLine("{");
                codeWriter.writeLine("}");
                codeWriter.writeLine();
            }
        }

        for(var o in creates){
            if(creates[o] instanceof type.UMLOperation){
                var params = [];

                if(creates[o].parameters.length)
                    for(var p in creates[o].parameters){
                        if(creates[o].parameters[p].direction == "in"){
                            var name = creates[o].parameters[p].name;
                            params.push("\n\t->set"+this.camelize(name, 1)+"($"+this.camelize(name)+")");
                        }

                    }

                creates[o].specification = "return self::create()"+params.join("")+";";

                this.writeMethod(codeWriter, creates[o], options, false, false);
                codeWriter.writeLine();
            }
        }
    };

    /**
     * Write Member Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeMemberVariable = function (codeWriter, elem, options) {
        if (elem.name.length > 0) {
            var terms = [];
            // doc
            var doc = "@var " + this.getType(elem, 1, 1) + " " + elem.documentation.trim();
            this.writeDoc(codeWriter, doc, options);

            // modifiers const
            if (elem.isFinalSpecification === true || elem.isLeaf === true) {
                terms.push("const " + elem.name.toUpperCase());
            }
            else {
                // modifiers
                var _modifiers = this.getModifiers(elem);
                if (_modifiers.length > 0) {
                    terms.push(_modifiers.join(" "));
                }
                // name
                terms.push("$" + elem.name);
            }
            // initial value
            if (elem.defaultValue && elem.defaultValue.length > 0) {
                terms.push("= " + elem.defaultValue );
            }else if(_.contains(["0..*", "1..*", "*"], elem.multiplicity.trim())) {
                terms.push("= []");
            }
            codeWriter.writeLine(terms.join(" ") + ";");
        }
    };

    PHPCodeGenerator.prototype.camelize = function (str, force) {
        return str
            .replace("_", " ")
            .replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
            if(force)
                return letter.toUpperCase();

            return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
        }).replace(/\s+/g, '');
    };

    PHPCodeGenerator.prototype.writeInterfaceMethods = function (codeWriter, elem, options, skipBody, skipParams) {
        var core = this;
        _.map(this.getSterotipe(elem), function(st){
            var operator = new type.UMLOperation();
            operator.specification = "// TODO: implement here"

            var paramReturn = new type.UMLParameter();
            paramReturn.direction = "return";

            switch(st.target.name.toLowerCase().substr(1)){
                case "iteratoraggregate":
                        operator.name = 'getIterator';
                        operator.isAbstract = elem.isAbstract;

                        operator.specification += "\nreturn new "+SEPARATE_NAMESPACE+"ArrayIterator(null);";

                        paramReturn.type = SEPARATE_NAMESPACE+'ArrayIterator';
                        operator.parameters.push(paramReturn);
                    break;

                case "countable":
                    operator.name = 'count';
                    operator.isAbstract = elem.isAbstract;

                    operator.specification += "\nreturn count(null);";

                    paramReturn.type = 'int';
                    operator.parameters.push(paramReturn);

                    break;

                default:

                    break;
            }

            if(operator.name){
                var len = 0, exists = false;

                for (i = 0, len = elem.operations.length; i < len; i++) {
                    if(elem.operations[i].name == operator.name)
                        exists = true;
                }

                if(!exists){
                    core.writeMethod(codeWriter, operator, options, false, false);
                    codeWriter.writeLine();
                }
            }

        });

        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            for(var i in _implements){
                if(_implements[i] instanceof type.UMLInterface){
                    _.map(_implements[i].operations, function(operator){
                        operator.specification = "// TODO: implement here"

                        var len = 0, exists = false;

                        for (i = 0, len = elem.operations.length; i < len; i++) {
                            if(elem.operations[i].name == operator.name)
                                exists = true;
                        }

                        if(!exists){
                            core.writeMethod(codeWriter, operator, options, false, false);
                            codeWriter.writeLine();
                        }
                    });
                }
            }
        }
    };


    PHPCodeGenerator.prototype.writeMethodSetGet = function (codeWriter, elem, parent, options, skipBody, skipParams) {
        var i, len, osetExists = false, ogetExists = false;

        if (elem.name.length > 0 && elem.visibility == "private" && !elem.isDerived) {
            var oset = new type.UMLOperation();
            var oget = new type.UMLOperation();
            var punt = "$this->";

            oget.isStatic = oset.isStatic = elem.isStatic;
            oset.name = 'set'+this.camelize(elem.name, 1);
            oget.name = (elem.type == "bool" ? 'is' : 'get')+this.camelize(elem.name, 1);
            oget._parent = oset._parent = elem._parent;

            if(elem.isStatic)
                punt = "self::$";

            var osetParam = (new type.UMLParameter());
            osetParam.name = this.camelize(elem.name);
            osetParam.type = elem.type;
            osetParam.documentation = elem.documentation;
            osetParam.multiplicity = elem.multiplicity;

            var osetReturn = (new type.UMLParameter());
            osetReturn.name = "$this";
            osetReturn.type = "$this";
            osetReturn.direction = "return";

            oset.parameters.push(osetParam);

            if(!elem.isStatic)
                oset.parameters.push(osetReturn);

            oset.specification = punt+elem.name+" = $"+this.camelize(elem.name)+";\n\n";

            var ogetReturn = (new type.UMLParameter());
            ogetReturn.type = elem.type;
            ogetReturn.multiplicity = elem.multiplicity;
            ogetReturn.direction = "return";

            oget.parameters.push(ogetReturn);
            oget.specification += "return "+punt+elem.name+";";

            for (i = 0, len = parent.operations.length; i < len; i++) {
                if (parent.operations[i].name === oset.name) {

                }
                if (parent.operations[i].name === oget.name) {
                    ogetExists = true;
                }
            }
            if(!osetExists){
                this.writeMethod(codeWriter, oset, options, false, false);
                codeWriter.writeLine();
            }
            if(!ogetExists){
                this.writeMethod(codeWriter, oget, options, false, false);
                codeWriter.writeLine();
            }

        }
    };

    /**
     * Write Method
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    PHPCodeGenerator.prototype.getParamName = function (name, trim) {
        if(name.indexOf('&') >=0 )
            if(trim)
                return "$"+name.replace('&', '');
            else
                return "&$"+name.replace('&', '');

        return "$"+name

    }

    PHPCodeGenerator.prototype.writeMethod = function (codeWriter, elem, options, skipBody, skipParams) {
        if (elem.name.length > 0) {
            var terms = [];
            var params = elem.getNonReturnParameters();
            var returnParam = elem.getReturnParameter();
            var _that = this;
            // doc
            var doc = elem.documentation.trim();
            _.each(params, function (param) {
                doc += "\n@param " + _that.getType(param, 1, 1) + " " + _that.getParamName(param.name, 1) + " " + param.documentation;
            });
            if (returnParam) {
                doc += "\n@return " + this.getType(returnParam, 1, 1) + " " + returnParam.documentation;
            }
            this.writeDoc(codeWriter, doc, options);

            // modifiers
            var _modifiers = this.getModifiers(elem);
            if (_modifiers.length > 0) {
                terms.push(_modifiers.join(" "));
            }

            terms.push("function");


            // name + parameters
            var paramTerms = [];
            if (!skipParams) {
                var i, len;
                for (i = 0, len = params.length; i < len; i++) {
                    var p = params[i];
                    var s = _that.getParamName(p.name);
                    var type = this.getType(p, 0);

                    if(type.indexOf('|') >=0 )
                        type = 'void';

                    var typeHint = type;
                    if (options.phpStrictMode && this.isAllowedTypeHint(type)) {
                        if (type.split("\\").length - 1 > 1) {
                            if(SEPARATE_NAMESPACE+this.namespace != type){
                            	codeWriter.writeLineInSection("use " + type.replace(/^\\+/, "") + ";", "uses");
                            }
                            typeHint = typeHint.replace(/^.*\\+/, "");
                        }
                        s = typeHint + " " + s;
                    }
                    if(p.defaultValue){
                        s += " = "+ p.defaultValue;
                    }

                    paramTerms.push(s);
                }
            }

            var functionName = elem.name + "(" + paramTerms.join(", ") + ")";
            if (options.phpReturnType) {
                functionName = functionName + ':' + this.getType(returnParam, 1);
            }
            terms.push(functionName);

            // body
            if (skipBody === true || _.contains(_modifiers, "abstract")) {
                codeWriter.writeLine(terms.join(" ") + ";");
            } else {
                codeWriter.writeLine(terms.join(" "));
                codeWriter.writeLine("{");
                codeWriter.indent();

                //spacification
                if (elem.specification.length > 0) {
                    this.writeSpac(codeWriter, elem.specification);

                    if (returnParam) {
                        var returnType = this.getType(returnParam, 1);
                        if(returnType === "$this"){
                            codeWriter.writeLine();
                            if(!elem.isStatic)
                                codeWriter.writeLine("return $this;");
                        }
                    }
                } else {
                    codeWriter.writeLine("// TODO: implement here");

                    // return statement
                    if (returnParam) {
                        var returnType = this.getType(returnParam, 1);
                        if (returnType === "boolean" || returnType === "bool") {
                            codeWriter.writeLine("return false;");
                        } else if (returnType === "int" || returnType === "long" || returnType === "short" || returnType === "byte") {
                            codeWriter.writeLine("return 0;");
                        } else if (returnType === "float" || returnType === "double") {
                            codeWriter.writeLine("return 0.0;");
                        } else if (returnType === "char") {
                            codeWriter.writeLine("return '0';");
                        } else if (returnType === "string") {
                            codeWriter.writeLine('return "";');
                        } else if (returnType === "array") {
                            codeWriter.writeLine("return array();");
                        } else if(returnType === "$this"){
                            if(!elem.isStatic)
                                codeWriter.writeLine("return $this;");
                        }  else if(returnType === "create"){
                            codeWriter.writeLine("return self::create();");
                        } else {
                            codeWriter.writeLine("return null;");
                        }
                    }
                }

                codeWriter.outdent();
                codeWriter.writeLine("}");
            }
        }
    };


    /**
     * Write Method Abstract for SuperClass
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipParams
     */
    PHPCodeGenerator.prototype.writeMethodSuperClass = function (codeWriter, _method, elem, options, skipParams) {

        var haveMethodName = false;

        // Methods
        for (var a = 0, length = elem.operations.length; a < length; a++) {
            if (elem.operations[a].name === _method.name) {
                haveMethodName = true;
            }
        }

        if (_method.name.length > 0 && !haveMethodName) {
            var terms = [];
            var params = _method.getNonReturnParameters();
            var returnParam = _method.getReturnParameter();
            var _that = this;

            // doc
            var doc = _method.documentation.trim();
            _.each(params, function (param) {
                doc += "\n@param " + _that.getType(param) + " " + _that.getParamName(param.name, 1) + " " + param.documentation;
            });
            if (returnParam) {
                doc += "\n@return " + this.getType(returnParam) + " " + returnParam.documentation;
            }
            this.writeDoc(codeWriter, doc, options);

            // modifiers
            var modifiers = [];
            var visibility = this.getVisibility(_method);
            if (visibility) {
                modifiers.push(visibility);
                terms.push(modifiers.join(" "));
            }

            terms.push("function");

            // name + parameters
            var paramTerms = [];
            if (!skipParams) {
                var i, len;
                for (i = 0, len = params.length; i < len; i++) {
                    var p = params[i];
                    var s = _that.getParamName(p.name)
                    if (options.phpStrictMode) {
                        s = _that.getType(p, 1) + ' ' + s;
                    }

                    paramTerms.push(s);
                }
            }

            var functionName = elem.name + "(" + paramTerms.join(", ") + ")";
            terms.push(_method.name + "(" + paramTerms.join(", ") + ")");

            // body
            codeWriter.writeLine(terms.join(" "));
            codeWriter.writeLine("{");
            codeWriter.indent();

            codeWriter.writeLine("// TODO implement here");

            codeWriter.outdent();
            codeWriter.writeLine("}");
        }

    };

    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeClass = function (codeWriter, elem, options) {
        var i, len, terms = [];

        // UseNamespace
        this.writeUseNamespaces(codeWriter, elem, options);

        // Doc
        var doc = elem.documentation.trim();
        if (ProjectManager.getProject().author && ProjectManager.getProject().author.length > 0) {
            doc += "\n@author " + ProjectManager.getProject().author;
        }
        this.writeDoc(codeWriter, doc, options);

        // Modifiers
        var _modifiers = this.getModifiersClass(elem);
        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(" "));
        }

        // Class
        if(elem.stereotype === "trait") terms.push("trait");
        else terms.push("class");

        terms.push(elem.name);

        // Extends
        var _extends = this.getSuperClasses(elem);
        var _superClass;
        if (_extends.length > 0) {
            _superClass = _extends[0];
            terms.push("extends " + _superClass.name);
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            terms.push("implements " + _.map(_implements, function (e) {
                    return e.name;
                }).join(", "));
        }

        codeWriter.writeLine(terms.join(" "));
        codeWriter.writeLine("{");
        codeWriter.indent();

        // Use
        this.writeUses(codeWriter, elem, options);

        codeWriter.writeLine();

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options);
            codeWriter.writeLine();
        }
        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i];
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end2, options);
                codeWriter.writeLine();
            } else if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end1, options);
                codeWriter.writeLine();
            }
        }

        // Constructor
        this.writeConstructor(codeWriter, elem, options);

        // Setters & Getters Methods
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMethodSetGet(codeWriter, elem.attributes[i], elem, options, false, false);
        }

        this.writeInterfaceMethods(codeWriter, elem, options, false, false);

        // Auxiliar Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            if(elem.operations[i].name.search('createWith') < 0){
                this.writeMethod(codeWriter, elem.operations[i], options, false, false);
                codeWriter.writeLine();
            }
        }

        if (typeof  _superClass !== "undefined") {
            // Methods
            for (var i = 0, len = _superClass.operations.length; i < len; i++) {
                var _method = _superClass.operations[i];
                if (typeof _method !== "undefined" && _method.isAbstract === true) {
                    this.writeMethodSuperClass(codeWriter, _method, elem, options, false);
                }
            }
        }
        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i];
            if (def instanceof type.UMLClass) {
                if (def.stereotype === "annotationType") {
                    this.writeAnnotationType(codeWriter, def, options);
                } else {
                    this.writeClass(codeWriter, def, options);
                }
                codeWriter.writeLine();
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options);
                codeWriter.writeLine();
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options);
                codeWriter.writeLine();
            }
        }

        codeWriter.outdent();
        codeWriter.lines.pop();
        codeWriter.writeLine("}");
        codeWriter.writeLine();
    };

    PHPCodeGenerator.prototype.writeUseNamespaces = function (codeWriter, elem, options) {
        var namespace, i, len, namespaces = [];

        for (i = 0, len = elem.attributes.length; i < len; i++) {
            if(elem.attributes[i].type instanceof type.UMLModelElement) {
                namespace = this.getType(elem.attributes[i]);

                if(namespace){
                    namespace = namespace.replace('[]', '').substr(1);

                    if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                        .split(SEPARATE_NAMESPACE).length > 1){

                        if(namespaces.indexOf(namespace) < 0)
                            namespaces.push(namespace);
                    }
                }
            }
        }

        var _traits = this.getSuperDependencies(elem);
        if (_traits.length > 0) {
            for(var t in _traits){

                if(_traits[t].target instanceof type.UMLClass){
                    namespace = this.getNamespaces(_traits[t].target).join(SEPARATE_NAMESPACE)+SEPARATE_NAMESPACE+_traits[t].target.name

                    if(namespace){
                        if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                                .split(SEPARATE_NAMESPACE).length > 1){

                            if(namespaces.indexOf(namespace) < 0)
                                namespaces.push(namespace);
                        }
                    }
                }
            }
        }

        // Extends
        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {
            for(var e in _extends){
                if(_extends[e] instanceof type.UMLClass){
                    if(!_extends[e].dontUse)
                        namespace = this.getNamespaces(_extends[e]).join(SEPARATE_NAMESPACE)+SEPARATE_NAMESPACE+_extends[e].name

                    if(namespace){
                        if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                                .split(SEPARATE_NAMESPACE).length > 1){

                            if(namespaces.indexOf(namespace) < 0)
                                namespaces.push(namespace);
                        }
                    }
                }
            }
        }

        // Implements
        var _implements = this.getSuperInterfaces(elem);
        if (_implements.length > 0) {
            for(var x in _implements){
                if(_implements[x] instanceof type.UMLInterface || _implements[x] instanceof type.UMLClass){
                    var namespace = this.getNamespaces(_implements[x]).join(SEPARATE_NAMESPACE)+SEPARATE_NAMESPACE+_implements[x].name

                    if(namespace){
                        if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                                .split(SEPARATE_NAMESPACE).length > 1){

                            if(namespaces.indexOf(namespace) < 0)
                                namespaces.push(namespace);
                        }
                    }
                }
            }
        }

        var _params = this.getParamNamespace(elem);
        if (_params.length > 0) {
            for(var p in _params){

                if(_params[p]){
                    namespace = _params[p];

                    if(typeof namespace == "string"){
                        if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                                .split(SEPARATE_NAMESPACE).length > 1){

                            if(namespaces.indexOf(namespace) < 0)
                                namespaces.push(namespace);
                        }
                    }
                }
            }
        }

        for(var i in elem.ownedElements){
            if(elem.ownedElements[i] instanceof type.UMLUseCase){
                namespace = this.getNamespaces(elem.ownedElements[i].stereotype).join(SEPARATE_NAMESPACE)+SEPARATE_NAMESPACE+elem.ownedElements[i].stereotype.name

                if(namespace){
                    if(namespace.replace(this.namespace+SEPARATE_NAMESPACE, '')
                            .split(SEPARATE_NAMESPACE).length > 1){

                        if(namespaces.indexOf(namespace) < 0)
                            namespaces.push(namespace);
                    }
                }
            }
        }


        if(namespaces.length){
            _.map(namespaces, function (e) {
                codeWriter.writeLine("use "+e+";");
            });

            codeWriter.writeLine();
        }
    };

    /**
     * Write Interface
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeInterface = function (codeWriter, elem, options) {
        var i, len, terms = [];

        // UseNamespace
        this.writeUseNamespaces(codeWriter, elem, options);

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);

        // Interface
        terms.push("interface");
        terms.push(elem.name);

        // Extends
        var _extends = this.getSuperClasses(elem);
        if (_extends.length > 0) {
            terms.push("extends " + _.map(_extends, function (e) {
                    return e.name;
                }).join(", "));
        }
        codeWriter.writeLine(terms.join(" "));
        codeWriter.writeLine("{");
        codeWriter.indent();

        // Member Variables
        // (from attributes)
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options);
            codeWriter.writeLine();
        }
        // (from associations)
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });
        for (i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i];
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end2, options);
                codeWriter.writeLine();
            } else if (asso.end2.reference === elem && asso.end1.navigable === true) {
                this.writeMemberVariable(codeWriter, asso.end1, options);
                codeWriter.writeLine();
            }
        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, true, false);
            codeWriter.writeLine();
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i];
            if (def instanceof type.UMLClass) {
                if (def.stereotype === "annotationType") {
                    this.writeAnnotationType(codeWriter, def, options);
                } else {
                    this.writeClass(codeWriter, def, options);
                }
                codeWriter.writeLine();
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options);
                codeWriter.writeLine();
            }
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    /**
     * Write Enum
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeEnum = function (codeWriter, elem, options) {
        var i, len, terms = [],
            literals = [];

        // UseNamespace
        this.writeUseNamespaces(codeWriter, elem, options);

        // Doc
        this.writeDoc(codeWriter, elem.documentation, options);

        // Enum
        terms.push("class");
        terms.push(elem.name);
        terms.push("extends");
        terms.push(SEPARATE_NAMESPACE + "SplEnum");

        codeWriter.writeLine(terms.join(" ") + "\n{");
        codeWriter.indent();

        // Literals
        for (i = 0, len = elem.literals.length; i < len; i++) {
            literals.push("const");
            literals.push(elem.literals[i].name);
            literals.push("=");
            literals.push(i);
            literlas.push(";");
        }

        codeWriter.writeLine(literals.join(" ") + "\n");

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    /**
     * Write AnnotationType
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PHPCodeGenerator.prototype.writeAnnotationType = function (codeWriter, elem, options) {
        var i, len, terms = [];

        // Doc
        var doc = elem.documentation.trim();
        if (Repository.getProject().author && Repository.getProject().author.length > 0) {
            doc += "\n@author " + Repository.getProject().author;
        }
        this.writeDoc(codeWriter, doc, options);

        // Modifiers
        var _modifiers = this.getModifiersClass(elem);

        if (_modifiers.length > 0) {
            terms.push(_modifiers.join(" "));
        }

        // AnnotationType
        terms.push("@interface");
        terms.push(elem.name);

        codeWriter.writeLine(terms.join(" ") + "\n{");
        codeWriter.writeLine();
        codeWriter.indent();

        // Member Variables
        for (i = 0, len = elem.attributes.length; i < len; i++) {
            this.writeMemberVariable(codeWriter, elem.attributes[i], options);
            codeWriter.writeLine();
        }

        // Methods
        for (i = 0, len = elem.operations.length; i < len; i++) {
            this.writeMethod(codeWriter, elem.operations[i], options, true, true);
            codeWriter.writeLine();
        }

        // Inner Definitions
        for (i = 0, len = elem.ownedElements.length; i < len; i++) {
            var def = elem.ownedElements[i];
            if (def instanceof type.UMLClass) {
                if (def.stereotype === "annotationType") {
                    this.writeAnnotationType(codeWriter, def, options);
                } else {
                    this.writeClass(codeWriter, def, options);
                }
                codeWriter.writeLine();
            } else if (def instanceof type.UMLInterface) {
                this.writeInterface(codeWriter, def, options);
                codeWriter.writeLine();
            } else if (def instanceof type.UMLEnumeration) {
                this.writeEnum(codeWriter, def, options);
                codeWriter.writeLine();
            }
        }

        codeWriter.outdent();
        codeWriter.writeLine("}");
    };

    /**
     * Is PHP allowed type hint ?
     * @param {string} type
     * @return {boolean}
     */
    PHPCodeGenerator.prototype.isAllowedTypeHint = function (type) {
        switch(type) {
            case "bool":
            case "boolean":
            case "int":
            case "integer":
            case "float":
            case "double":
            case "string":
            case "resource":
            case "void":
            case "mixed":
                return false;
            default:
                return true;
        }
    };

    /**
     * Generate
     * @param {type.Model} baseModel
     * @param {string} basePath
     * @param {Object} options
     */
    function generate(baseModel, basePath, options) {
        var result = new $.Deferred();
        var phpCodeGenerator = new PHPCodeGenerator(baseModel, basePath);
        return phpCodeGenerator.generate(baseModel, basePath, options);
    }

    exports.generate = generate;

});
