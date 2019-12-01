define_tag('mono-key', function(c) {
	if(c == 'connected') {
		if(this.hasAttribute('onchange')) {
			this.event_onchange = new Function(STATE(this, 'onchange')).bind(this)
		}
		else {
			this.event_onchange = (function() { }).bind(this)
		}

		this.shadowRoot.innerHTML = `
			<style>
				:host,
				textarea,
				section {
					font-size: 16px;
					font-family: "Lucida Console", Monaco, monospace;
					overflow: scroll;
					caret-color: #0f0;
					border: 0;
					padding: 0;
					resize: none;
					tab-size: 4;
					white-space: nowrap;
				}
				:host {
					position: relative;
					display: block;
					height: 100px;
					width: 200px;
					overflow: hidden;
				}

				/*
					textarea::-webkit-scrollbar {
						width: .4em;
						background-color: #F5F5F5;
					}
					
					textarea::-webkit-scrollbar-thumb {
						background-color: #000000;
					}
				*/

				section {
					scroll: none;
				}

				section::selection,
				textarea::selection {
					background: #0f0;
					color: #fff;
				}

				.comment {
					color: #aaa;
				}

				#indentation {
					margin-left: -1px;
					border-left: 1px solid #505050;
					box-sizing: border-box;
				}
			</style>
			<section
				style='
					position: absolute;
					width: 100%;
					height: 100%;
					background: #272822;
					color: #fff;
					white-space: pre;
					overflow: hidden;
					line-height: 1em;
					padding: .5em;
				'
				id='renderer'
			></section>
			<textarea
				spellcheck='false'
				style='
					position: absolute;
					width: 100%;
					height: 100%;
					background: transparent;
					color: transparent;
					outline: none;
					overflow-x: auto;
					overflow-y: auto;
					line-height: 1em;
					padding: .5em;
				'
				id='editor'
				onkeydown='
					//this.t_keydown = setTimeout(() => {
						//clearTimeout(this.t_keydown)
						
						CONTEXT(this, "indent")(this, event)
					setTimeout(() => {
						CONTEXT(this, "sync")(event)
					}, 0)
				'
				_onkeyup='context(this, "sync")(event)'
				oninput='
					//this.t_input = setTimeout(() => {
					//	clearTimeout(this.t_input)
					//	this.t_input = undefined
					//	context(this, "sync")()
					//}, 10)
				'
				onscroll='context(this, "scroll")(event)'
				contenteditable
			></textarea>
		`

		let renderer = find(this.shadowRoot, '#renderer')[0]
		let editor = find(this.shadowRoot, '#editor')[0]
		let here = this
		editor.value = html_unescape(state(this, 'value'))



		this.focus = function() {
			editor.focus()
		}
		// UNDO STACK
			this.undo_stack = []
			this.undo_pos = 0
			CONTEXT(this, 'undo_push', () => {
				if(this.undo_pos > this.undo_stack.length)
					this.undo_stack = this.undo_stack.slice(0, this.undo_position)

				this.undo_stack.push(editor.value)
				this.undo_pos = this.undo_stack.length - 1
			})

			CONTEXT(this, 'undo_load', () => {
				editor.value = this.undo_stack[this.undo_pos]
				CONTEXT(this, "sync")()
			})

			CONTEXT(this, 'undo', () => {
				if(this.undo_pos > 0) {
					this.undo_pos--
					CONTEXT(this, 'undo_load')()
				}
			})

			CONTEXT(this, 'redo', () => {
				if(this.undo_pos < this.undo_stack.length - 1) {
					this.undo_pos++
					CONTEXT(this, 'undo_load')()
				}
			})

			setInterval(() => {
				if(editor.value != this.undo_stack[this.undo_pos])
					CONTEXT(this, 'undo_push')()
			}, 300)

		CONTEXT(this, 'indent', (here, e) => {
			if(e.ctrlKey && e.code == "KeyZ") {
				e.preventDefault()
				CONTEXT(this, 'undo')()
				return
			}

			if(e.ctrlKey && e.code == "KeyY") {
				e.preventDefault()
				CONTEXT(this, 'redo')()
				return
			}

			if(e.code == 'Tab' && here.selectionStart == here.selectionEnd) {
				e.preventDefault()
				var s = here.selectionStart
				//here.value =
				let start = here.selectionStart
				let finish = here.selectionEnd
				let text_before = here.value.substring(
						0,
						start
					)
				let text_middle = INLINE(() => {
						let value = here.value.substring(
							start,
							finish
						)
						if(e.shiftKey == false)
							return value.replace(/\n/g, "\n\t").replace(/    /g, "\t")
						else
							return value.replace(/\n\t/g, "\n").replace(/    /g, "\t")
		
					})
				let text_after = here.value.substring(
						finish,
						here.value.length
					)
				here.value = text_before + "\t" + text_after


				here.selectionStart = start + 1
				here.selectionEnd = start + 1

				return
			}

			if(e.code == 'Tab' && here.selectionStart != here.selectionEnd) {
				e.preventDefault()
				var s = here.selectionStart
				//here.value =
				let start = here.value.substring(
						0,
						here.selectionStart
					).lastIndexOf('\n')
				let finish = here.selectionEnd
				let text_before = here.value.substring(
						0,
						start
					)
				let text_middle = INLINE(() => {
						let value = here.value.substring(
							start,
							finish
						)
						if(e.shiftKey == false)
							return value.replace(/\n/g, "\n\t").replace(/    /g, "\t")
						else
							return value.replace(/\n\t/g, "\n").replace(/    /g, "\t")
		
					})
				let text_after = here.value.substring(
						finish,
						here.value.length
					)
				here.value = text_before + text_middle + text_after
				here.selectionStart = start + 1
				here.selectionEnd = text_before.length + text_middle.length

				return
			}


			
		})
	
		CONTEXT(this, 'sync', () => {
		//	renderer.innerHTML =

			function render(text) {
				let result = []
				let patterns = {
					comment: "(\\/\\/|\\-\\-\\s).*",
					multline_comment: "\\/\\*[\\s\\S]*?\\*\\/",
					template_string: "\\`.*\\`",
					double_quote: "\\\".*?\\\"",
					quote: "\\'.*?\\'",
					//object: "\\w+?\\.",
					//vb_comment: "\\'[\\s\\S]*?\\n",
					bash_comment: "\\# [\\s\\S]*?\\n",
					//regex: "\\/.*?\\/",

					indentation: "\\t",

					//brackets: "\\{|\\}|\\(|\\)|\\[|\\]",
				
					operator: "(\\+\\=|\\=\\=|\\=|\\+|\\.|\\+|\\*|\\-|\\<\\-|\\-\\>|\\&|\\|\\!|\\;|\\,|\\<\\=|\\=\\>|\\<\\<|\\>\\>|\\<\\>|\\>|\\<|\\:\\=|\\/|\\!|\\|)",
					js_method: "\\w+(?=\\()",
					instruction: "(\\b)(else"
						+ "|do|then|this|self|yield|let|const|var|call"
						+ "|return|function|module|func|sub|case|break|default|new|delete|update|set"
						+ "|end|boolean|byref|byval|typeof|extends|inherits|done"
						+ "|and|or|if|else|then|endif|fi"
						+ "|of|in|use|when|not|distinct|has|get|is|null"
						+ "|interval|day|month|year|dim|next|redim|each|loop"
						+ "|on|and|or|between|like|while|for|true|false"
						+ "|namespace|public|private|static|class|package|import|interface|async|await"
						// SQL
						+ "|create|table|if|exists"
						+ "|update|insert|into|values|select|delete|drop|from|as"
						+ "|join|inner|outer|left|right|union|all"
						+ "|where|having|order|group|by|limit|offset"
						+ ")(\\b)",
					type: "(\\b)(double|float|void|boolean|string|char|float32|float64|int|varchar)(\\s|$|\\b)",
					//indentation: "[^|\\n].+\\b\\t",
					//indentation: "(?:^|\\r)\\t*\\w*\\t",
					//indentation: "((?:^|\\r)\\t*\\w*\\t)",
					//indentation: ".*\\t",
					//indentation: "\\t*\\w*\\t",
					//css_prop: "[a-zA-Z0-9\\-]+\\:",

					html_prop: "(\\-|\\_|\\w)+(\\=|\\:)",
					html_finish_tag: "\\<\\/\\w*\\>",
					html_start_tag: "\\<\\w*\\>*",

					internal_method: "(for|if|while|do|foreach|require|import|include|switch)(?=\\()",
					new_line: "\\n",
					numeric: "\\b[0-9]+\\b",
					//closure: "\\(|\\)|\\[|\\]|\\{|\\}",
					anything: ".+?"
				}

				let pattern_string
				let ptrn = new RegExp(
					pattern_string = REDUCE(
						ENTRIES(patterns),
						(m, [key, value]) => `${m}|(?<${key}>${value})`,
						""
					).slice(1),
					'gi'
				)
				//console.log(pattern_string)
				
				//let match
				//while ((match = ptrn.exec(text)) != null) {
				//	result.push(JSON.parse(JSON.stringify(match.groups)))
				//}

				result = ARRAY(
					[...text.matchAll(ptrn)],
					(m, c) => PUSH(
						m,
						//c.groups
						JSON.parse(JSON.stringify(c.groups))

						//OBJECT(
						//	ENTRIES(c.groups),
						//	(m, [key, value]) => {
						//		if(value != undefined)
						//			m[key] = value
						//		return m
						//	}
						//)
					)
				)
				//console.log(result);
				
				let result2 = reduce(
					result,
					(m, c) => {
						let [group, content] = entries(c)[0]
						//console.log(content)
						let r = ""

						content = content
							.replace(/\&/g, '&amp;')
							.replace(/\\/g, '&#92;')
							//.replace(/\//g, '&#47;')
							.replace(/\</g, '&lt;')
							.replace(/\>/g, '&gt;')
							.replace(/\n/g, '<br>')
							.replace(/\r/g, '<br>')
							//.replace(/(\t|\s|^|&nbsp;)(.*\:)/g, '<span style="color: #6CC72C">$2</span>')
							//.replace(/\t/g, `    `)
							//.replace(/\t/g, '&#09;')
							//.replace(/\t/g, '&emsp;')
							.replace(/ /g, '&nbsp;')

						switch(group) {
							// comments
							case "comment":
							case "multline_comment":
							case "vb_comment":
							case "bash_comment":
								r = `<span style='color: #656859;'>${content.replace(/(\t)/g, "<span id='indentation'>$1</span>")}</span>`
								break

							// just text
							case "template_string":
							case "double_quote":
							case "quote":
							case "object":
								r = `<span style='color: #DFD67B;'>${content}</span>`
								break

							case "numeric":
								r = `<span style='color: #ae81ff;'>${content}</span>`
								break


							// organization
							case "indentation":
								
								//r = content
								//	.replace(
								//		/^(\t*)/,
								//		'$1'
								//	)
								//
								//console.log(content)
								r = `<span id='indentation'>${content}</span>`
								break

							// attributes
							case "css_prop":
							case "html_prop":
								r = `<span style='color: #DF5077;'>${content}</span>`
								break

							// entities
							case "regex":
							case "instruction":
								r = `<span style='color: #DB312E;'>${content}</span>`
								break

							case "type":
								r = `<span style='color: #f92672;'>${content}</span>`
								break

							//case "brackets":
							//	r = `<span style='color: #d8d8d8;'>${content}</span>`
							//	break

							case "html_finish_tag":
							case "html_start_tag":
								r = content
									.replace(
										/(&lt;*)(\/*)(.*)(&gt;*)/,
										`$1$2<span style='color: #DB312E;'>$3</span>$4`
									)
								break

							// execute
							case "js_method":
								r = content
									.replace(
										/(.*)(\(*)/,
										`<span style='color: #63D3E8;'>$1</span>`
									)
								break

							case "internal_method":
								r = content
									.replace(
										/(.*)(\(*)/,
										`<span style='color: #DB312E;'>$1</span>`
									)
								break

							//case "object":
							case "params":
							case "operator":
							case "closure":
								r = `<span style='color: #FA8416;'>${content}</span>`
								break

							case "new_line":
								r = `<br>`
								break

							case "anything":
							default:
								r = content
								break
						}
					return m + r
				}, '')

				return result2
			}
			renderer.innerHTML = render(editor.value) + "<br>"

			//STATE(this, 'value', editor.value)
			//editor.textContent = editor.value
			this.setAttribute('value', html_escape(editor.value))
			this.value = html_escape(editor.value)
			

			if(here.hasAttribute('autoheight')) {
				editor.style.height = "auto"
				//editor.style.overflowY = "hidden"
				//let value = editor.scrollHeight + 16
				let value = (count(editor.value, /\n/g) + 3)* 16
				
				editor.style.height = value
				here.style.height = value
			}

			if(this.first_rendered)
				this.event_onchange()

			this.first_rendered = true
		})
		CONTEXT(this, 'sync')()

		CONTEXT(this, 'scroll', (e) => {
			renderer.scrollTop = editor.scrollTop
			renderer.scrollLeft = editor.scrollLeft
			//renderer.style.height = editor.offsetHeight
		})
		CONTEXT(this, 'scroll')()


		CONTEXT(this, 'press', (e) => {
			//if(e.key == 'Tab') {
			//	e.preventDefault()
			//	//document.execCommand('inserttext', false, '    ')
			//	document.execCommand('inserttext', false, '\t')
			//}
			//setTimeout(function(){
			//}, 0)
		})



	}
		
})
