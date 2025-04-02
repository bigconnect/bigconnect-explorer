// admin/bundled/reprocess/ReprocessManager.jsx

define([
    'flight/lib/component',
    'util/withFormFieldErrors',
    'react',
    'react-dom',
    'create-react-class',
    'public/v1/api'
], function(
    defineComponent,
    withFormFieldErrors,
    React,
    ReactDOM,
    createReactClass,
    bcApi) {
    'use strict';

    const ENTITY_TYPES = [
        {id: 'instagramPost', name: 'Instagram Posts'},
        {id: 'fbPost', name: 'Facebook Posts'},
        {id: 'ttVideo', name: 'TikTok Videos'},
        {id: 'twitterPost', name: 'Twitter Posts'},
        {id: 'instagramComment', name: 'Instagram Comments'},
        {id: 'webArticle', name: 'Web Articles'}
    ];

    const ReprocessComponent = createReactClass({
        getInitialState() {
            return {
                selectedTypes: {},
                priority: 'LOW',
                status: 'ready', // 'ready', 'processing', 'success', 'error'
                errorMessage: '',
                workspaceId: null,
                workspaces: [] // Initialize workspaces array
            };
        },

        componentDidMount() {
            this.loadAllWorkspaces();
        },

        loadAllWorkspaces() {
            bcApi.connect().then(({dataRequest}) => {
                dataRequest('workspace', 'all')
                    .then(workspaces => {
                        console.log('Retrieved workspaces:', workspaces);
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
            this.setState({ workspaceId: e.target.value });
        },

        handleCheckboxChange(e) {
            const { value, checked } = e.target;
            this.setState(state => ({
                selectedTypes: {
                    ...state.selectedTypes,
                    [value]: checked
                }
            }));
        },

        handlePriorityChange(e) {
            this.setState({ priority: e.target.value });
        },

        handleSubmit() {
            const { selectedTypes, priority } = this.state;
            const typesToProcess = Object.keys(selectedTypes).filter(key => selectedTypes[key]);

            if (typesToProcess.length === 0) {
                this.setState({ errorMessage: 'Please select at least one entity type' });
                return;
            }

            this.setState({ status: 'processing', errorMessage: '' });

            console.log('Starting reprocess with workspace ID:', this.getWorkspaceId());

            const promises = typesToProcess.map(type => {
                return $.ajax({
                    url: 'vertex/requeue-many',
                    method: 'GET',
                    data: {
                        concept: type,
                        priority
                    },
                    headers: {
                        'bc-workspace-id': this.getWorkspaceId()
                    }
                });
            });

            Promise.all(promises)
                .then(() => {
                    this.setState({ status: 'success' });
                    setTimeout(() => this.setState({ status: 'ready' }), 2000);
                })
                .catch(error => {
                    console.error('Error reprocessing:', error);
                    this.setState({ status: 'error' });
                    setTimeout(() => this.setState({ status: 'ready' }), 2000);
                });
        },

        getButtonProperties() {
            const { status } = this.state;
            switch (status) {
                case 'processing':
                    return { text: 'Processing...', disabled: true, className: 'btn-primary' };
                case 'success':
                    return { text: 'Reprocess Complete', disabled: true, className: 'btn-success' };
                case 'error':
                    return { text: 'Error - Try Again', disabled: false, className: 'btn-danger' };
                default:
                    return { text: 'Reprocess Selected', disabled: false, className: 'btn-primary' };
            }
        },

        render() {
            const { errorMessage, workspaces } = this.state;
            const buttonProps = this.getButtonProperties();

            return (
                <div className="reprocess-container">
                    <h2>Reprocess Entities</h2>
                    <p className="text-muted">Select entity types to reprocess and click the button below.</p>

                    {/* Workspace selector dropdown */}
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

                    <div className="entity-types form-group">
                        <label>Entity Types:</label>
                        <div className="checkbox-list">
                            {ENTITY_TYPES.map(type => (
                                <div className="checkbox" key={type.id}>
                                    <label>
                                        <input
                                            type="checkbox"
                                            value={type.id}
                                            onChange={this.handleCheckboxChange}
                                        /> {type.name}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {errorMessage && <div className="errors">{errorMessage}</div>}

                    <button
                        className={`btn ${buttonProps.className} reprocess-button`}
                        onClick={this.handleSubmit}
                        disabled={buttonProps.disabled}
                    >
                        {buttonProps.text}
                    </button>

                    <style jsx>{`
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
                        
                        .priority-selection,
                        .workspace-selection {
                            max-width: 300px;
                            margin-bottom: 15px;
                        }
                        
                        .errors {
                            color: #a94442;
                            margin-bottom: 10px;
                        }
                    `}</style>
                </div>
            );
        }
    });

    return defineComponent(ReprocessManager, withFormFieldErrors);

    function ReprocessManager() {
        this.after('initialize', function() {
            ReactDOM.render(
                React.createElement(ReprocessComponent),
                this.node
            );

            this.on('teardown', function() {
                ReactDOM.unmountComponentAtNode(this.node);
            });
        });
    }
});