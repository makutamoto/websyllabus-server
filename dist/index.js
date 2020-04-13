"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var path_1 = __importDefault(require("path"));
var express_1 = __importDefault(require("express"));
var mysql_1 = __importDefault(require("mysql"));
if (process.env.WSS_DB_HOST === undefined)
    throw new Error("WSS_DB_HOST not set.");
if (process.env.WSS_DB_USER === undefined)
    throw new Error("WSS_DB_USER not set.");
if (process.env.WSS_DB_PASSWORD === undefined)
    throw new Error("WSS_DB_PASSWORD not set.");
if (process.env.WSS_DB_DATABASE === undefined)
    throw new Error("WSS_DB_DATABASE not set.");
var PORT = Number(process.env.WSS_PORT) || 80;
var app = express_1.default();
var db;
var quick_validate = /[;\-'`"]+/;
function sendData(res, status, data) {
    res.status(status).send({ status: status, data: data });
}
function internalServerError(res, err) {
    if (err) {
        sendData(res, 500, { msg: 'Internal Server Error' });
        throw err;
    }
}
function notFound(res, data) {
    if (data === undefined || data.length === 0) {
        sendData(res, 404, { msg: "Not Found" });
        return false;
    }
    return true;
}
function ok(res, data) {
    sendData(res, 200, data);
}
function validateData() {
    var data = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        data[_i] = arguments[_i];
    }
    for (var _a = 0, data_1 = data; _a < data_1.length; _a++) {
        var datum = data_1[_a];
        if (quick_validate.test(datum))
            return true;
    }
    return false;
}
function createArrayFromDictionaryWithKey(dictionary) {
    var keys = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        keys[_i - 1] = arguments[_i];
    }
    return dictionary.map(function (a) {
        var temp = {};
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            temp[key] = a[key];
        }
        return temp;
    });
}
app.use(express_1.default.static(path_1.default.join(__dirname, '../build')));
app.get('/json', function (_req, res) {
    db.query('SELECT DISTINCT `college` FROM `subject_info`;', function (err, results) {
        internalServerError(res, err);
        ok(res, { list: createArrayFromDictionaryWithKey(results, 'college') });
    });
});
app.get('/:college/json', function (req, res) {
    var college = req.params.college;
    if (validateData(college)) {
        notFound(res);
        return;
    }
    db.query('SELECT DISTINCT `department` FROM `subject_info` WHERE `college` = ?;', college, function (err, results) {
        internalServerError(res, err);
        if (notFound(res, results))
            ok(res, { list: createArrayFromDictionaryWithKey(results, 'department') });
    });
});
app.get('/:college/:department/json', function (req, res) {
    var college = req.params.college;
    var department = req.params.department;
    if (validateData(college, department)) {
        notFound(res);
        return;
    }
    db.query('SELECT DISTINCT `course_code`, `course_title`, `student_grade` FROM `subject_info` WHERE `college` = ? AND `department` = ?;', [college, department], function (err, results) {
        internalServerError(res, err);
        if (notFound(res, results))
            ok(res, { list: createArrayFromDictionaryWithKey(results, 'course_code', 'course_title', 'student_grade') });
    });
});
app.get('/:college/:department/:course/json', function (req, res) {
    var college = req.params.college;
    var department = req.params.department;
    var course = req.params.course;
    if (validateData(college, department, course)) {
        notFound(res);
        return;
    }
    db.query('SELECT `course_code`, `college`, `year`, `course_title`, `course_category`, `class_format`, `credits`, `department`, `student_grade`, `term`, `classes_per_week`, `textbook_and_or_teaching_materials`, `instructor`, `course_plan_first_term`, `course_plan_second_term`, `evaluation_weight`, `original_url` FROM `subject_info` WHERE `college` = ? AND `department` = ? AND `course_code` = ? LIMIT 1;', [college, department, course], function (err, results) {
        var data;
        internalServerError(res, err);
        if (notFound(res, results)) {
            data = createArrayFromDictionaryWithKey(results, 'course_code', 'college', 'year', 'course_title', 'course_category', 'class_format', 'credits', 'department', 'student_grade', 'term', 'classes_per_week', 'textbook_and_or_teaching_materials', 'instructor', 'course_plan_first_term', 'course_plan_second_term', 'evaluation_weight', 'original_url')[0];
            data.course_plan_first_term = JSON.parse(data.course_plan_first_term);
            data.course_plan_second_term = JSON.parse(data.course_plan_second_term);
            data.evaluation_weight = JSON.parse(data.evaluation_weight);
            ok(res, data);
        }
    });
});
app.get('/*', function (_req, res) { return res.sendFile(path_1.default.join(__dirname, '../build', 'index.html')); });
function connect(callback) {
    db = mysql_1.default.createConnection({
        host: process.env.WSS_DB_HOST,
        user: process.env.WSS_DB_USER,
        password: process.env.WSS_DB_PASSWORD,
        database: process.env.WSS_DB_DATABASE,
        charset: 'utf8mb4',
    });
    db.connect(function (err) {
        if (err)
            throw err;
        if (callback)
            callback();
    });
    db.on('error', function (err) {
        if (err.code == 'PROTOCOL_CONNECTION_LOST') {
            console.log("Database connection has been refused.");
            console.log("Reconecting...");
            connect();
        }
        else {
            throw err;
        }
    });
}
process.on('SIGINT', function () {
    console.log("Quitting...");
    if (db !== undefined) {
        db.end(function (err) {
            if (err)
                throw err;
            process.exit();
        });
    }
});
console.log("Waiting for database to start... (10 sec.)");
setTimeout(function () { return connect(function () { return app.listen(PORT, function () { return console.log("Web Syllabus Server listening on port " + PORT + "."); }); }); }, 10000);
