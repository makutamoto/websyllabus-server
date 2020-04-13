import path from 'path';
import express from 'express';
import mysql from 'mysql';

if(process.env.WSS_DB_HOST === undefined) throw new Error("WSS_DB_HOST not set.");
if(process.env.WSS_DB_USER === undefined) throw new Error("WSS_DB_USER not set.");
if(process.env.WSS_DB_PASSWORD === undefined) throw new Error("WSS_DB_PASSWORD not set.");
if(process.env.WSS_DB_DATABASE === undefined) throw new Error("WSS_DB_DATABASE not set.");

const PORT = Number(process.env.WSS_PORT) || 80;

const app = express();
const db = mysql.createConnection({
    host: process.env.WSS_DB_HOST,
    user: process.env.WSS_DB_USER,
    password: process.env.WSS_DB_PASSWORD,
    database: process.env.WSS_DB_DATABASE,
});

const quick_validate = /[;\-'`"]+/;

interface Data {
    status: number,
    data: any,
}
function sendData(res: express.Response, status: number, data: any): void {
    res.status(status).send({ status, data });
}

function internalServerError(res: express.Response, err: mysql.MysqlError | null) {
    if(err) {
        sendData(res, 500, { msg: 'Internal Server Error' });
        throw err;
    }
}
function notFound(res: express.Response, data?: Dictionary[]): boolean {
    if(data === undefined || data.length === 0) {
        sendData(res, 404, { msg: "Not Found" });
        return false;
    }
    return true;
}
function ok(res: express.Response, data: any): void {
    sendData(res, 200, data);
}

function validateData(...data: string[]): boolean {
    for(let datum of data) {
        if(quick_validate.test(datum)) return true;
    }
    return false;
}

interface Dictionary {
    [index: string]: string,
}
function createArrayFromDictionaryWithKey(dictionary: Dictionary[], ...keys: string[]) {
    return dictionary.map(a => {
        let temp: Dictionary = {};
        for(let key of keys) temp[key] = a[key];
        return temp;
    });
}

app.use(express.static(path.join(__dirname, '../build')));

app.get('/json', (_req: express.Request, res: express.Response) => {
    db.query('SELECT DISTINCT `college` FROM `subject_info`;', (err: mysql.MysqlError | null, results: Dictionary[]) => {
        internalServerError(res, err);
        ok(res, { list: createArrayFromDictionaryWithKey(results, 'college') });
    });
});

app.get('/:college/json', (req: express.Request, res: express.Response) => {
    let college = req.params.college;
    if(validateData(college)) {
        notFound(res);
        return;
    }
    db.query('SELECT DISTINCT `department` FROM `subject_info` WHERE `college` = ?;', college, (err: mysql.MysqlError | null, results: Dictionary[]) => {
        internalServerError(res, err);
        if(notFound(res, results)) ok(res, { list: createArrayFromDictionaryWithKey(results, 'department') });
    });
});

app.get('/:college/:department/json', (req: express.Request, res: express.Response) => {
    let college = req.params.college;
    let department = req.params.department;
    if(validateData(college, department)) {
        notFound(res);
        return;
    }
    db.query('SELECT DISTINCT `course_code`, `course_title`, `student_grade` FROM `subject_info` WHERE `college` = ? AND `department` = ?;', [college, department], (err: mysql.MysqlError | null, results: Dictionary[]) => {
        internalServerError(res, err);
        if(notFound(res, results)) ok(res, { list: createArrayFromDictionaryWithKey(results, 'course_code', 'course_title', 'student_grade') });
    });
});

app.get('/:college/:department/:course/json', (req: express.Request, res: express.Response) => {
    let college = req.params.college;
    let department = req.params.department;
    let course = req.params.course;
    if(validateData(college, department, course)) {
        notFound(res);
        return;
    }
    db.query('SELECT `course_code`, `college`, `year`, `course_title`, `course_category`, `class_format`, `credits`, `department`, `student_grade`, `term`, `classes_per_week`, `textbook_and_or_teaching_materials`, `instructor`, `course_plan_first_term`, `course_plan_second_term`, `evaluation_weight`, `original_url` FROM `subject_info` WHERE `college` = ? AND `department` = ? AND `course_code` = ? LIMIT 1;', [college, department, course], (err: mysql.MysqlError | null, results: Dictionary[]) => {
        let data: Dictionary;
        internalServerError(res, err);
        if(notFound(res, results)) {
            data = createArrayFromDictionaryWithKey(results, 'course_code', 'college', 'year', 'course_title', 'course_category', 'class_format', 'credits', 'department', 'student_grade', 'term', 'classes_per_week', 'textbook_and_or_teaching_materials', 'instructor', 'course_plan_first_term', 'course_plan_second_term', 'evaluation_weight', 'original_url')[0];
            data.course_plan_first_term = JSON.parse(data.course_plan_first_term);
            data.course_plan_second_term = JSON.parse(data.course_plan_second_term);
            data.evaluation_weight = JSON.parse(data.evaluation_weight);
            ok(res, data);
        }
    });
});

app.get('/*', (_req: express.Request, res: express.Response) => res.sendFile(path.join(__dirname, '../build', 'index.html')));

db.connect((err) => {
    if(err) throw err;
    
    process.on('SIGINT', () => {
        console.log("Quitting...");
        db.end((err) => {
            if(err) throw err;
            process.exit();
        });
    });
    
    app.listen(PORT, () => console.log(`Web Syllabus Server listening on port ${PORT}.`));
});
