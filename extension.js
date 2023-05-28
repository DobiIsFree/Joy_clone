const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios').default;
const CryptoJS = require('crypto-js');

var sampleList = [];
var check = true;

var NumberOfTest = 0;
var NumberOfTestcase = [];

var problems = [];

const AESKEY = "0123456789abcdef0123456789abcdef";
const config = vscode.workspace.getConfiguration("JOY");

var server_ip = config.get("serverIP");
var ID = config.get("ID");


/**
 * @param {vscode.ExtensionContext} context
*/

function activate(context){
	async function fetchProblem() {
		try{
			const response = await axios.get(server_ip + "/api/v1/problems");
			const data = response.data;

			NumberOfTest = data.length;

			const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			const testFolderName = 'test';
			const testFolderPath = path.join(workspacePath, testFolderName);

			for (var i = 0; i<NumberOfTest; i++){
				fs.mkdirSync(testFolderPath + i);
				await makeTestCase(i);
				var problem = {
					id: i,
					check: false,
					path: testFolderPath,
					isCompile: false,
					title: data[i].title,
					content: data[i].content,
					testInputSample: data[i].exampleTestInput,
					testOutputSample: data[i].exampleTestOutput
				};
				problems.push(problem);
			}
		} catch (error){
			console.log('API 호출 중 오류 발생: ', error.message);
		}
	}

	function decodeByAES256(key, data){
		const cipher = CryptoJS.AES.decrypt(data, CryptoJS.enc.Utf8.parse(key), {
			iv: CryptoJS.enc.Utf8.parse(""),
			padding: CryptoJS.pad.Pkcs7,
			mode: CryptoJS.mode.CBC
		});
		return cipher.toString(CryptoJS.enc.Utf8);
	};

	async function makeTestCase(num){
		var path1 = vscode.workspace.workspaceFolders[0].uri.fsPath + "/test" + num;
		const testCaseFolerName = 'testcase';
		const testCaseFolerPath = path.join(path1, testCaseFolerName);
		fs.mkdir(testCaseFolerPath, (err) => {
			if(err){
				console.log('Failed to create testcase folder: ' +  err.message);
			} else {
				console.log('Testcase foler created successfully');
			}
		});

		const mainPath = path.join(path1, "main.c");
		fs.writeFileSync(mainPath, '');

		try{
			const response = await axios.get(server_ip + "/api/v1/testcases");
			const data = response.data;

			var path2 = vscode.workspace.workspaceFolders[0].uri.fsPath + '/test' + num + "/testcase";
			for(var j = 0; j < data[num][0].length; j++){
				const testCasePath = path.join(path2, "tcout" + j);
				fs.writeFileSync(testCasePath, data[num][1][j]);
			}
		} catch(error){
			console.log('API 호출 중 에러: ', error.message);
		}
	}

	let help = vscode.commands.registerCommand('JOY.help', function() {
		const view = vscode.window.createWebviewPanel(
			'joy.help',
			'Help JOY',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true
			}
		);
		let htmlContent = view.webview.html;
		// txt file 외부 변경
		// htmlContent += '<h2>1. Enter the server\'s IP and your ID in the settings of the JOY Extension</h2> \
		//   				  <h2>2. Use the "JOY:Get Problem" command to receive the problem</h2>\
		// 				  <h2>3. Use the "JOY:Show Problem" command to determine the content of the problem</h2>\
		// 				  <h2>4. Example inputs and outputs for the problem can be found in the sidebar</h2>\
		// 				  <h2>5. Write the code in the main.c in each test folder created</h2>\
		// 				  <h2>6. When you\'re done writing the code, use the "JOY:Judge On You" command to score</h2>\
		// 				  <h2>7. Use the "JOY:Get Result" command to check the results for the code</h2>\
		// 				  <h2>7. If you have solved all the problems, use the "JOY:Send Result" command to send the results</h2>'

		// fetch('/resource/help.txt')
		// .then(response => response.text())
		// .then(data => {
		// 	console.log(data);
		// })
		// .catch(error => {
		// 	console.error(error);
		// });

		view.webview.html = htmlContent;				  
	});



	
	let get_problem = vscode.commands.registerCommand('Joy.get', async function() {
		server_ip = config.get("serverIP");
		ID = config.get("ID");

		console.log(server_ip);
		console.log(ID);

		await fetchProblem();

		try{
			const response = await axios.get(server_ip + "/api/v1/testcases");
			const data = response.data;
			console.log("Encrypto TestCase: " + data);
			for (var i = 0; i < NumberOfTest; i++){
				NumberOfTestcase.push(data[i][0].length);
			}
		} catch(error){
			console.error('API 호출 중 오류 발생: ', error.message);
		}

		function createTestcaseSampleTreeView(){
			vscode.window.createTreeView('joy-InOut',{
				treeDataProvider: new testcaseSampleProvider()
			});
		}

		for (var i = 0; i < NumberOfTest; i++) {
			var inputArray = problems[i].testInputSample[0].split('\n')
			var outputArray = problems[i].testOutputSample[0].split('\n')
			const test = new TestcaseSample("test" + i, vscode.TreeItemCollapsibleState.Collapsed);
			const input = new TestcaseSample("Input" + i, vscode.TreeItemCollapsibleState.Collapsed);
			const output = new TestcaseSample("Output" + i, vscode.TreeItemCollapsibleState.Collapsed);
			test.addChild(input);
			test.addChild(output);

			for (var j = 0; j < inputArray.length; j++){
				const testcase = new TestcaseSample(inputArray[j], vscode.TreeItemCollapsibleState.None);
				input.addChild(testcase);
			}
			for (var j=0; j<outputArray.length; j++){
				const testcase = new TestcaseSample(outputArray[j], vscode.TreeItemCollapsibleState.None);
				output.addChild(testcase);
			}
			sampleList.push(test);
		}
		createTestcaseSampleTreeView();

		vscode.window.showInformationMessage("문제를 성공적으로 가지고 왔습니다. test 폴더의 main.c에서 코드를 작성해주세요.")
		
	});

	let get_result = vscode.commands.registerCommand('JOY.result', function() {
		const activeEditor = vscode.window.activeTextEditor;
		const activeFilePath = activeEditor.document.fileName;
		const problemNum = (path.dirname(activeFilePath)).slice(-1); 

		console.log("Problem ID : "+problems[problemNum].id);
		if(problems[problemNum].isCompile){
			problems[problemNum].check = check;
		}

		console.log("problem check: " + problems[problemNum].check);
		if(problems[problemNum].check){
			vscode.window.showInformationMessage("TestCase 통과");
		} else {
			vscode.window.showInformationMessage("TestCase 통과 실패");
		}
	});

	let show_problem = vscode.commands.registerCommand('JOY.show', function() {
		for (var i = 0; i < NumberOfTest ; i++){
			const view = vscode.window.createWebviewPanel (
				'joy.problem', 
				'test' + i,
				vscode.ViewColumn.Two,
				{
					enableScripts: true
				}
			);
			let htmlContent = view.webview.html;
			htmlContent += '<h2>' + i + '번 문제: ' + problems[i].title + '</h2>' + problems[i].content;
			view.webview.html = htmlContent;
		}
	});

	let send_result = vscode.commands.registerCommand('JOY.send', function(){
		var results = [];
		for (var i = 0; i < NumberOfTest; i++){
			results.push(problems[i].check);
		}
		console.log("result: " + results);

		const data = {
			studentId: ID,
			result: results
		}

		axios.post(server_ip + "/api/v1/results", JSON.stringify(data), {
			headers: {
				'Content-Type': 'application/json'
			}
		})
		.then(response => {
			console.log(response.data);
		})
		.catch(error => {
			console.error(error);
		});
	});

	let test = vscode.commands.registerCommand('JOY.test', async function() {
		const activateEditor = vscode.window.activeTextEditor;
		if(!activateEditor){
			vscode.window.showErrorMessage('열린 파일을 찾을 수 없습니다.');
			return;
		}

		const activeFilePath = activateEditor.document.fileName;
		const input = [];

		const problemNum = (path.dirname(activeFilePath)).slice(-1);

		for(var i = 0; i < NumberOfTestcase[problemNum]; i++){
			const temp_input = path.join(path.dirname(activeFilePath), 'testcase/tcin' + i);
			const input_value = readInputFromFile(temp_input);
			input.push(decodeByAES256(AESKEY, input_value));
		}

		// main.c 파일의 상대 경로 계산
        const filePath = path.join(path.dirname(activeFilePath), 'main.c');
		const programPath = path.join(path.dirname(activeFilePath), 'program');
        // 컴파일 명령어와 실행 인수 설정
        const compileCommand = 'gcc';
        const compileArgs = ['-o', programPath, filePath];  // 'program' create exec file

		const compileProcess = spawn(compileCommand, compileArgs);

		compileProcess.stdout.on('data', (data) => {
            console.log('컴파일 출력: ' + data);
        });

        compileProcess.stderr.on('data', (data) => {
            console.error('컴파일 에러: ' + data);
        });

		compileProcess.on('close', code => {
			check = true;
			if(code === 0){
				console.log('complete compile');

				const activeEditor = vscode.window.activeTextEditor;
				const activeFilePath = activeEditor.document.fileName;
				const problemNum = (path.dirname(activeFilePath)).slice(-1);

				for (var i=0; i<NumberOfTestcase[problemNum]; i++){
					var runCommand = path.join(path.dirname(activeFilePath), 'program');
					const runProcess = spawn(runCommand);

					runProcess.stdin.write(input[i]);
					runProcess.stdin.end();

					const temp_output = path.join(path.dirname(activeFilePath), 'testcase/tcout'+i);
					const output_value = readInputFromFile(temp_output);

					runProcess.stdout.on('data', async(data) => {
						if(data.toString() == decodeByAES256(AESKEY, output_value)){
							await handleTestCaseResult(true);
						} else {
							await handleTestCaseResult(false);
						}
						vscode.window.showInformationMessage('complete complie. Check your result through command: get result');
					});

					runProcess.stderr.on('data', (data) => {
						console.error('program err: ' + data);
					});

					runProcess.on('close', (code) => {
						console.log('exit program, code: ' + code);
					});
				}
			} else {
				console.error('complile error');
			}
		});

	});

	async function handleTestCaseResult(passed) {
		if (passed) {
			const activeEditor = vscode.window.activeTextEditor;
			const activeFilePath = activeEditor.document.fileName;
			const problemNum = (path.dirname(activeFilePath)).slice(-1);
			problems[problemNum].isCompile = true;
		} else {
			const activeEditor = vscode.window.activeTextEditor;
			const activeFilePath = activeEditor.document.fileName;
			const problemNum = (path.dirname(activeFilePath)).slice(-1);
			problems[problemNum].isCompile = true;
			check = false;
		}
	}

	context.subscriptions.push(get_problem);
	context.subscriptions.push(show_problem);
	context.subscriptions.push(get_result);
	context.subscriptions.push(test);
	context.subscriptions.push(send_result);
	context.subscriptions.push(help);

}

function deactivate() {}

function readInputFromFile(filePath) {
	try {
		const absolutePath = filePath;
		const input = fs.readFileSync(absolutePath, 'utf-8');
		return input;
	} catch (error) {
		console.error('Error reading input file: ', error);
		return null;
	}
}

class testcaseSampleProvider{
	getTreeItem(element) {
        return element;
    }
	getChildren(element){
        if (!element) {
			// Root 노드의 하위 항목 반환
			return Promise.resolve(sampleList);
		} else {
			// 각 항목의 하위 항목 반환
			return Promise.resolve(element.children);
		}
    }
}

class TestcaseSample extends vscode.TreeItem {
	constructor (
		label,
		collapsibleStae,
	) {
		super (label, collapsibleStae);
		this.children = []
	}
	addChild(child) {
		this.children.push(child);
	}
	getChildren(){
		return this.children;
	}
}

module.exports = {
	activate,
	deactivate
}