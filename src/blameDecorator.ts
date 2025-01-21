import * as vscode from 'vscode'
import moment from 'moment'

export function createBlameDecorations(blameInfo: string[], maxLength: number) {
    const decorations: vscode.DecorationOptions[] = []
    const commitDates: { [key: string]: moment.Moment } = {}

    blameInfo.forEach(line => {
        let match = line.match(/^\^?(\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
        if (!match) {
            match = line.match(/^\^?(\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
        }

        if (match) {
            const commitHash = match[1]
            const date = match[3]
            commitDates[commitHash] = moment(date, 'YYYY-MM-DD')
        }
    })

    const sortedCommits = Object.entries(commitDates).sort((a, b) => b[1].diff(a[1]))
    const recentCommits = sortedCommits.slice(0, 7).map(entry => entry[0])

    blameInfo.forEach((line, index) => {
        let match = line.match(/^\^?(\w+)\s\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
        if (!match) {
            match = line.match(/^\^?(\w+)\s.*?\((.*?)\s+(\d{4}-\d{2}-\d{2})\s.*?\s(\d+)\)\s/)
        }

        if (match) {
            const commitHash = match[1]
            let author = match[2]
            const date = match[3]
            const lineNumber = parseInt(match[4], 10) - 1

            if (author.includes('@')) {
                author = author.split('@')[0]
            }

            if (author === 'Not Committed Yet') {
                author = 'NCY'
            }

            const dateMoment = moment(date, 'YYYY-MM-DD')
            let blameText = ''

            if (moment().diff(dateMoment, 'days') <= 7) {
                blameText = dateMoment.fromNow()
            } else {
                blameText = dateMoment.format('YYYY/MM/DD')
            }

            blameText += ` ${author}`

            while (blameText.length < maxLength) {
                blameText += ' '
            }

            if (commitHash !== '000000000') {
                let backgroundColor = 'rgba(36,41,57,0.7)'
                let textColor = 'rgb(255,255,255)'

                const commitIndex = recentCommits.indexOf(commitHash)
                if (commitIndex !== -1) {
                    const opacity = 0.9 - commitIndex * 0.1
                    backgroundColor = `rgba(0, 122, 255, ${opacity})`
                } else {
                    textColor = 'rgb(142,145,152)'
                }

                const decoration = {
                    range: new vscode.Range(lineNumber, 0, lineNumber, 0),
                    renderOptions: {
                        before: {
                            contentText: ` ${blameText}`,
                            color: textColor,
                            backgroundColor: backgroundColor,
                            fontStyle: 'normal',
                            fontWeight: 'normal',
                            margin: '0 1em 0 0',
                            textDecoration: 'none',
                            borderRadius: '3px 0 0 3px',
                            padding: '0 5px',
                            width: '250px',
                            display: 'inline-block',
                            cursor: 'block',
                            borderWidth: '0 2px 0 0',
                            borderStyle: 'solid',
                            borderColor: 'rgb(111,99,212)',
                        },
                        light: {
                            before: {
                                color: textColor,
                                backgroundColor: backgroundColor,
                            },
                        },
                        dark: {
                            before: {
                                color: textColor,
                                backgroundColor: backgroundColor,
                            },
                        },
                    },
                }
                decorations.push(decoration)
            } else {
                const decoration = {
                    range: new vscode.Range(lineNumber, 0, lineNumber, 0),
                    renderOptions: {
                        before: {
                            contentText: ` NCY`,
                            color: 'rgb(255,0,0)',
                            backgroundColor: 'rgba(36,41,57,0.7)',
                            fontStyle: 'normal',
                            fontWeight: 'normal',
                            margin: '0 1em 0 0',
                            textDecoration: 'none',
                            borderRadius: '3px 0 0 3px',
                            padding: '0 5px',
                            width: `250px`,
                            display: 'inline-block',
                            cursor: 'block',
                            borderWidth: '0 2px 0 0',
                            borderStyle: 'solid',
                            borderColor: 'rgb(111,99,212)',
                        },
                        light: {
                            before: {
                                color: 'rgb(255,0,0)',
                                backgroundColor: 'rgba(36,41,57,0.7)',
                            },
                        },
                        dark: {
                            before: {
                                color: 'rgb(255,0,0)',
                                backgroundColor: 'rgba(36,41,57,0.7)',
                            },
                        },
                    },
                }
                decorations.push(decoration)
            }
        }
    })
    return decorations
}
