define([
    'flight/lib/component',
    'util/withFormFieldErrors',
    'react',
    'react-dom',
    'create-react-class',
    'public/v1/api'
], function (
    defineComponent,
    withFormFieldErrors,
    React,
    ReactDOM,
    createReactClass,
    bcApi
) {
    'use strict';

    const ENTITY_TYPES = [
        {id: 'image', name: 'Images'}
    ];

    const ReprocessComponent = createReactClass({
        getInitialState() {
            return {
                selectedTypes: {},
                priority: 'LOW',
                status: 'ready',       // 'ready', 'processing', 'success', 'error'
                deleteStatus: 'ready', // 'ready', 'processing', 'success', 'error'
                errorMessage: '',
                workspaceId: null,
                workspaces: [],        // Initialize workspaces array
                currentYear: false,    // New state for current_year flag
                selectAll: false       // New state for select all checkbox
            };
        },

        componentDidMount() {
            this.loadAllWorkspaces();
        },

        loadAllWorkspaces() {
            bcApi.connect().then(({dataRequest}) => {
                dataRequest('workspace', 'all')
                    .then(workspaces => {
                        this.setState({
                            workspaces: workspaces,
                            workspaceId: workspaces.length > 0 ? workspaces[0].workspaceId : 'public-ontology'
                        });
                    })
                    .catch(error => {
                        console.error('Error retrieving workspaces:', error);
                        this.setState({
                            workspaces: [],
                            workspaceId: 'public-ontology'
                        });
                    });
            });
        },

        getWorkspaceId() {
            return this.state.workspaceId || 'public-ontology';
        },

        handleWorkspaceChange(e) {
            this.setState({workspaceId: e.target.value});
        },

        handleCheckboxChange(e) {
            const {value, checked} = e.target;
            this.setState(state => {
                const newSelectedTypes = {
                    ...state.selectedTypes,
                    [value]: checked
                };

                // Check if all are selected to update selectAll state
                const allSelected = ENTITY_TYPES.every(type => newSelectedTypes[type.id]);

                return {
                    selectedTypes: newSelectedTypes,
                    selectAll: allSelected
                };
            });
        },

        // New handler for current_year checkbox
        handleCurrentYearChange(e) {
            this.setState({currentYear: e.target.checked});
        },

        // New handler for select all checkbox
        handleSelectAllChange(e) {
            const checked = e.target.checked;
            const newSelectedTypes = {};

            ENTITY_TYPES.forEach(type => {
                newSelectedTypes[type.id] = checked;
            });

            this.setState({
                selectAll: checked,
                selectedTypes: newSelectedTypes
            });
        },

        handlePriorityChange(e) {
            this.setState({priority: e.target.value});
        },

        handleSubmit() {
            const {selectedTypes, priority, currentYear} = this.state;
            const typesToProcess = Object.keys(selectedTypes).filter(key => selectedTypes[key]);

            if (typesToProcess.length === 0) {
                this.setState({errorMessage: 'Please select at least one entity type'});
                return;
            }

            this.setState({status: 'processing', errorMessage: ''});
            console.log('Starting reprocess with workspace ID:', this.getWorkspaceId());
            console.log('Current year only:', currentYear);
            console.log('Concepts to process:', typesToProcess);

            // Still sending individual requests for each selected type
            // This ensures we maintain the same behavior when using "Select All"
            const promises = typesToProcess.map(type => {
                return $.ajax({
                    url: 'vertex/requeue-many',
                    method: 'GET',
                    data: {
                        concept: type,
                        priority,
                        currentYear: currentYear  // Add the current_year flag to the API call
                    },
                    headers: {
                        'bc-workspace-id': this.getWorkspaceId()
                    }
                });
            });

            Promise.all(promises)
                .then(() => {
                    this.setState({status: 'success'});
                    setTimeout(() => this.setState({status: 'ready'}), 2000);
                })
                .catch(error => {
                    console.error('Error reprocessing:', error);
                    this.setState({status: 'error'});
                    setTimeout(() => this.setState({status: 'ready'}), 2000);
                });
        },

        handleDelete() {
            const {selectedTypes} = this.state;
            const typesToDelete = Object.keys(selectedTypes).filter(key => selectedTypes[key]);

            if (typesToDelete.length === 0) {
                this.setState({errorMessage: 'Please select at least one entity type'});
                return;
            }

            this.setState({
                deleteStatus: 'processing',
                errorMessage: '',
                progress: {
                    concept: '',
                    processed: 0,
                    total: 0,
                    percentComplete: 0
                }
            });

            console.log('Starting deletion for selected concept types:', typesToDelete);

            // Process each type sequentially to avoid overwhelming the server
            const processNextType = (index) => {
                if (index >= typesToDelete.length) {
                    // All types processed
                    this.setState({deleteStatus: 'success'});
                    setTimeout(() => this.setState({deleteStatus: 'ready'}), 2000);
                    return;
                }

                const type = typesToDelete[index];
                console.log(`Processing ${type}...`);

                this.setState({
                    progress: {
                        ...this.state.progress,
                        concept: type,
                        processed: 0,
                        total: 0,
                        percentComplete: 0
                    }
                });

                $.ajax({
                    url: 'vertex/remove-classification-props',
                    method: 'GET',
                    data: {
                        concept: type
                    },
                    headers: {
                        'bc-workspace-id': this.getWorkspaceId()
                    },
                    timeout: 300000
                })
                    .then(progressResult => {
                        console.log(`Completed processing ${type}:`, progressResult);

                        // Move to the next concept type
                        processNextType(index + 1);
                    })
                    .catch(error => {
                        console.error(`Error processing ${type}:`, error);
                        this.setState({deleteStatus: 'error'});
                        setTimeout(() => this.setState({deleteStatus: 'ready'}), 2000);
                    });
            };

            // Start with the first type
            processNextType(0);
        },

        getButtonProperties() {
            const {status} = this.state;
            switch (status) {
                case 'processing':
                    return {text: 'Processing...', disabled: true, className: 'btn-primary'};
                case 'success':
                    return {text: 'Reprocess Complete', disabled: true, className: 'btn-success'};
                case 'error':
                    return {text: 'Error - Try Again', disabled: false, className: 'btn-danger'};
                default:
                    return {text: 'Reprocess Selected', disabled: false, className: 'btn-primary'};
            }
        },

        getDeleteButtonProperties() {
            const {deleteStatus} = this.state;
            switch (deleteStatus) {
                case 'processing':
                    return {text: 'Deleting...', disabled: true, className: 'btn-warning'};
                case 'success':
                    return {text: 'Delete Complete', disabled: true, className: 'btn-success'};
                case 'error':
                    return {text: 'Error - Try Again', disabled: false, className: 'btn-danger'};
                default:
                    return {text: 'Delete Selected', disabled: false, className: 'btn-warning'};
            }
        },

        render() {
            const {errorMessage, workspaces, currentYear, selectAll, progress} = this.state;
            const buttonProps = this.getButtonProperties();
            const deleteButtonProps = this.getDeleteButtonProperties();

            return (
                <div className="reprocess-container">
                    <h2>Reprocess Entities</h2>
                    <p className="text-muted">Select entity types to reprocess or delete and click the appropriate
                        button below.</p>

                    <div className="form-group workspace-selection">
                        <label>Workspace:</label>
                        <select
                            className="form-control workspace-select"
                            onChange={this.handleWorkspaceChange}
                            value={this.state.workspaceId || ''}
                        >
                            <option value="public-ontology">PUBLIC</option>
                            {workspaces.map(workspace => (
                                <option key={workspace.workspaceId} value={workspace.workspaceId}>
                                    {workspace.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group priority-selection">
                        <label>Priority:</label>
                        <select
                            className="form-control priority-select"
                            onChange={this.handlePriorityChange}
                            value={this.state.priority}
                        >
                            <option value="LOW">Low</option>
                            <option value="NORMAL">Normal</option>
                            <option value="HIGH">High</option>
                        </select>
                    </div>

                    {/* Current year checkbox */}
                    <div className="form-group current-year-option">
                        <div className="checkbox">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={currentYear}
                                    onChange={this.handleCurrentYearChange}
                                /> Only process items modified in current year
                            </label>
                        </div>
                    </div>

                    <div className="entity-types form-group">
                        <label>Entity Types:</label>

                        {/* Select all checkbox */}
                        <div className="checkbox select-all">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={this.handleSelectAllChange}
                                /> <strong>Select All</strong>
                            </label>
                        </div>

                        <div className="checkbox-list">
                            {ENTITY_TYPES.map(type => (
                                <div className="checkbox" key={type.id}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            value={type.id}
                                            checked={!!this.state.selectedTypes[type.id]}
                                            onChange={this.handleCheckboxChange}
                                        /> {type.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {errorMessage && <div className="errors">{errorMessage}</div>}

                    {/* Progress display for deletion */}
                    {this.state.deleteStatus === 'processing' && this.state.progress && (
                        <div className="progress-container">
                            <div className="progress-header">
                                Processing: {this.state.progress.concept}
                            </div>
                            <div className="progress">
                                <div
                                    className="progress-bar progress-bar-striped active"
                                    role="progressbar"
                                    style={{width: `${this.state.progress.percentComplete}%`}}
                                >
                                    {this.state.progress.percentComplete}%
                                </div>
                            </div>
                            {this.state.progress.total > 0 && (
                                <div className="progress-text">
                                    Processed {this.state.progress.processed} of {this.state.progress.total} items
                                </div>
                            )}
                        </div>
                    )}

                    <div className="button-group">
                        <button
                            className={`btn ${buttonProps.className} reprocess-button`}
                            onClick={this.handleSubmit}
                            disabled={buttonProps.disabled}
                        >
                            {buttonProps.text}
                        </button>
                        <button
                            className={`btn ${deleteButtonProps.className} delete-button`}
                            onClick={this.handleDelete}
                            disabled={deleteButtonProps.disabled}
                            style={{marginLeft: '10px'}}
                        >
                            {deleteButtonProps.text}
                        </button>
                    </div>

                    <style>{`
                .reprocess-container {
                    padding: 20px;
                }
            
                .checkbox-list {
                    max-height: 300px;
                    overflow-y: auto;
                    border: 1px solid #ddd;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
            
                .select-all {
                    margin-bottom: 10px;
                }
            
                .priority-selection,
                .workspace-selection,
                .current-year-option {
                    max-width: 300px;
                    margin-bottom: 15px;
                }
            
                .errors {
                    color: #a94442;
                    margin-bottom: 10px;
                }
            
                .button-group button {
                    min-width: 150px;
                }
                
                .progress-container {
                    margin: 15px 0;
                    max-width: 600px;
                }
                
                .progress-header {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .progress {
                    height: 20px;
                    margin-bottom: 5px;
                }
                
                .progress-text {
                    font-size: 12px;
                    color: #666;
                }
            `}</style>
                </div>
            );
        }
    });

    return defineComponent(ReprocessManager, withFormFieldErrors);

    function ReprocessManager() {
        this.after('initialize', function () {
            ReactDOM.render(
                React.createElement(ReprocessComponent),
                this.node
            );

            this.on('teardown', function () {
                ReactDOM.unmountComponentAtNode(this.node);
            });
        });
    }
});
