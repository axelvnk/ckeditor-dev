/* bender-tags: editor,unit */
/* bender-ckeditor-plugins: stylesheetparser,tableresize,wysiwygarea */

'use strict';

function createMoveEventMock( table ) {
	var definedX;

	return {
		move: function() {
			definedX = this.getPageOffset().x + 20;
		},

		getPageOffset: function() {
			var pillars = table.getCustomData( '_cke_table_pillars' );

			return {
				x:
					// If x is defined use it.
					definedX ? definedX :
					// For the first run x does not matter, because we want to create pillars.
					pillars ? pillars[ 0 ].x :
					// Return 0 otherwise.
					0
			};
		},

		getTarget: function() {
			return {
				is: function() {
					return 'table';
				},

				getAscendant: function() {
					return table;
				},

				type: CKEDITOR.NODE_ELEMENT
			};
		},

		preventDefault: function() {
			// noop
		},
		// We need this because on build version magicline plugin
		// also listen on 'mousemove'.
		$: {
			clientX: 0,
			clientY: 0
		}
	};
}

var editorsDefinitions = {
		classic: {
			name: 'classic'
		},
		inline: {
			name: 'inline',
			creator: 'inline'
		}
	};

function init( table, editor ) {
	var evtMock = createMoveEventMock( table ),
		mouseElement = !editor ? new CKEDITOR.dom.document( document ) :
						editor.editable().isInline() ? editor.editable() :
						editor.document;

	// Run for the first time to crate pillars
	mouseElement.fire( 'mousemove', evtMock );
	// Run for the second time to create resizer
	mouseElement.fire( 'mousemove', evtMock );
}

function resize( table, callback ) {
	var doc = table.getDocument(),
		resizer = getResizer( doc ),
		moveEvtMock = createMoveEventMock( table ),
		evtMock = {	preventDefault: function() {} };

	resizer.fire( 'mousedown', evtMock );
	resizer.fire( 'mousemove', moveEvtMock );

	moveEvtMock.move();
	resizer.fire( 'mousemove', moveEvtMock );

	doc.fire( 'mouseup', evtMock );

	setTimeout( function() {
		callback();
	}, 1 );
}

function getResizer( doc ) {
	return doc.find( 'div[data-cke-temp]' ).getItem( 0 );
}

bender.tools.setUpEditors( editorsDefinitions, function( editors ) {
	bender.test( {
		assertIsResized: function( table, name ) {
			var width = parseInt( table.getStyle( 'width' ), 10 );
			assert.isTrue( width > 40, name + ' should be resized.' );
		},

		assertIsNotTouched: function( table, name ) {
			assert.areSame( '', table.getStyle( 'width' ), name + ' should not be touched.' );
		},

		'test classic editor': function() {
			var editor = editors.classic,
				doc = editor.document,
				globalDoc = new CKEDITOR.dom.document( document ),
				insideTable = doc.getElementsByTag( 'table' ).getItem( 0 ),
				outsideTable = globalDoc.getById( 'outside' );

			init( insideTable, editor );

			assert.areSame( 1, doc.find( 'div[data-cke-temp]' ).count(), 'Resizer should be inited.' );
			assert.areSame( 0, globalDoc.find( 'div[data-cke-temp]' ).count(), 'Global document should not be touched.' );

			this.assertIsNotTouched( insideTable, 'insideTable' );
			this.assertIsNotTouched( outsideTable, 'outsideTable' );

			resize( insideTable, function() {
				resume( function() {
					this.assertIsResized( insideTable, 'insideTable' );
					this.assertIsNotTouched( outsideTable, 'outsideTable' );

					// With true to avoid updating textarea what may cause test fail after refreshing window -
					// Firefox will load the cached old value.
					editor.destroy( true );

					assert.areSame( 0, doc.find( 'div[data-cke-temp]' ).count(), 'Resizer should be removed.' );
				} );
			} );

			wait();
		},

		'test inline editor': function() {
			var editor = editors.inline,
				doc = editor.document,
				insideTable = editor.document.getById( 'inside' ),
				outsideTable = CKEDITOR.document.getById( 'outside' );

			init( insideTable, editor );

			assert.areSame( 1, doc.find( 'div[data-cke-temp]' ).count(), 'Resizer should be inited.' );

			this.assertIsNotTouched( insideTable, 'outsideTable' );
			this.assertIsNotTouched( outsideTable, 'outsideTable' );

			resize( insideTable, function() {
				resume( function() {
					this.assertIsResized( insideTable, 'insideTable' );

					init( outsideTable );
					resize( outsideTable, function() {
						resume( function() {
							this.assertIsNotTouched( outsideTable, 'outsideTable' );

							editor.destroy();

							assert.areSame( 0, doc.find( 'div[data-cke-temp]' ).count(), 'Resizer should be removed.' );
						} );
					} );

					wait();
				} );
			} );

			wait();
		}
	} );
} );