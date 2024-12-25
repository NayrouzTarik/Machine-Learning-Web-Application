from django.db import models
from django.contrib.auth.models import User
import os
from django.conf import settings
from django.shortcuts import render
from pre_traitement.clean import clean_dataset, detect_target_column
import pandas as pd
from ml_models.decision_tree import DT
from ml_models.kmeans import KMeans
from ml_models.KNN import KNN
from ml_models.naive_bayes import naive_bayes
from ml_models.neural_network import MLP_model
from ml_models.random_forest import RF
from ml_models.regression import regression_model
from ml_models.svm import SVM
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import csrf_exempt
import json
import numpy as np
from io import StringIO

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer, np.floating)):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, pd.DataFrame):
            return obj.to_dict()
        return super(NumpyEncoder, self).default(obj)

class MLModelEncoder(json.JSONEncoder):
    def default(self, obj):
        if hasattr(obj, 'tolist'):
            return obj.tolist()
        if hasattr(obj, '__dict__'):
            return str(type(obj).__name__)
        try:
            return float(obj)
        except (TypeError, ValueError):
            return str(obj)

def get_user_data_dir(user):
    user_data_dir = os.path.join(settings.MEDIA_ROOT, 'user_data_files', user.username)
    print(f"Creating directory: {user_data_dir}")
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)
        print(f"Directory created: {user_data_dir}")
    else:
        print(f"Directory already exists: {user_data_dir}")
    return user_data_dir

def process_data(file_path):
    try:
        file_extension = os.path.splitext(file_path)[1].lower()

        if file_extension == '.csv':
            data = None
            success = False
            delimiters = [';', ',', '\t']
            encodings = ['utf-8', 'latin1', 'iso-8859-1']

            for delimiter in delimiters:
                if success:
                    break
                for encoding in encodings:
                    try:
                        temp_data = pd.read_csv(
                            file_path,
                            delimiter=delimiter,
                            encoding=encoding,
                            quotechar='"',
                            on_bad_lines='warn'
                        )
                        # Validate proper parsing
                        if len(temp_data.columns) > 1:
                            data = temp_data
                            print(f"Successfully read with delimiter: {delimiter}, encoding: {encoding}")
                            success = True
                            break
                    except Exception as e:
                        print(f"Failed with delimiter: {delimiter}, encoding: {encoding}, error: {str(e)}")
                        continue

            if not success:
                return {"error": "Unable to read CSV file with any delimiter or encoding"}

        elif file_extension in ['.xls', '.xlsx']:
            data = pd.read_excel(file_path)
        else:
            return {"error": "Unsupported file type"}

        # Clean column names
        data.columns = [str(col).strip().strip('"').strip("'") for col in data.columns]

        # Remove any completely empty columns or rows
        data = data.dropna(how='all', axis=1).dropna(how='all', axis=0)

        # Handle NaN values
        data = data.fillna('')

        # Basic statistics
        statistics = {
            "columns": data.columns.tolist(),
            "shape": data.shape,
            "null_values": data.isnull().sum().to_dict(),
            "duplicates_count": data.duplicated().sum(),
            "dtypes": data.dtypes.astype(str).to_dict(),
        }

        try:
            # Numeric analysis
            numeric_data = data.select_dtypes(include=['number'])
            if not numeric_data.empty:
                statistics.update({
                    'mean_values': numeric_data.mean().to_dict(),
                    'variance_values': numeric_data.var().to_dict(),
                    'std_values': numeric_data.std().to_dict(),
                    'correlation_with_all_variables': numeric_data.corr().to_dict()
                })

            # Categorical analysis
            categorical_data = data.select_dtypes(include=['object', 'category'])
            if not categorical_data.empty:
                category_stats = {}
                for col in categorical_data.columns:
                    category_stats[col] = categorical_data[col].value_counts().to_dict()
                statistics['category_analysis'] = category_stats

            # Target column detection
            target_column, task_type = detect_target_column(data)
            statistics['target_column'] = target_column
            statistics['task_type'] = task_type

        except Exception as e:
            print(f"Error in statistical analysis: {str(e)}")
            statistics['analysis_error'] = str(e)

        return statistics

    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        return {"error": str(e)}

@login_required
def upload_data(request):
    if request.method == 'POST' and request.FILES.get('file'):
        try:
            user = request.user
            file = request.FILES['file']

            user_data_dir = get_user_data_dir(user)
            os.makedirs(user_data_dir, exist_ok=True)
            file_path = os.path.join(user_data_dir, file.name)

            with open(file_path, 'wb+') as f:
                for chunk in file.chunks():
                    f.write(chunk)

            statistics = process_data(file_path)
            if 'error' in statistics:
                return JsonResponse({
                    'success': False,
                    'error': statistics['error']
                })

            print("\n\nStatistiques des données :\n")
            print(f"Dimensions des données : {statistics['shape']}")
            print(f"Nombre de doublons : {statistics['duplicates_count']}")

            dtypes_df = pd.DataFrame.from_dict(statistics['dtypes'], orient='index', columns=['Type'])
            print("\nTypes des colonnes :\n", dtypes_df)

            null_values_df = pd.DataFrame.from_dict(statistics['null_values'], orient='index', columns=['Null Values'])
            print("\nValeurs nulles par colonne :\n", null_values_df)

            summary_stats_df = pd.DataFrame({
                'Mean': statistics['mean_values'],
                'Variance': statistics['variance_values'],
                'Std Dev': statistics['std_values']
            })
            print("\nStatistiques résumées :\n", summary_stats_df)

            print("\nMatrice de corrélation :\n", statistics['correlation_with_all_variables'])

            print("\nAnalyse des colonnes catégoriques :")
            for col, counts in statistics['category_analysis'].items():
                print(f"\nColonne '{col}' :\n", pd.DataFrame.from_dict(counts, orient='index', columns=['Occurrences']))

            print(f"\nColonne cible : {statistics['target_column']}")
            print(f"Type de tâche : {statistics['task_type']}")

            serializable_stats = json.loads(json.dumps(statistics, cls=NumpyEncoder))

            file_extension = os.path.splitext(file_path)[1].lower()
            if file_extension == '.csv':
                df = pd.read_csv(file_path)
            elif file_extension in ['.xls', '.xlsx']:
                df = pd.read_excel(file_path)
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Unsupported file type'
                })

            df = df.fillna('')

            request.session['df'] = df.to_json()
            request.session['statistics'] = serializable_stats

            return JsonResponse({
                'success': True,
                'message': 'File uploaded successfully',
                'statistics': serializable_stats
            })

        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })

    return JsonResponse({
        'success': False,
        'error': 'No file provided'
    })

def process(request):
    return render(request, 'process.html')

@login_required
def clean_data(request):
    if request.method == 'POST':
        data_json = request.session.get('df')
        if not data_json:
            print("Error: No data available for cleaning.")
            return JsonResponse({'error': "No data available for cleaning."})

        df = pd.read_json(data_json)

        df_cleaned = clean_dataset(df)
        request.session['cleaned_data'] = df_cleaned.to_json()

        target_column, problem_type = detect_target_column(df_cleaned)

        print("\n--- Results of data cleaning and preprocessing ---\n")
        print(f"Detected target column: {target_column if target_column else 'None'}")
        print(f"Detected problem type: {problem_type if problem_type else 'Unknown'}")
        print("\n--- End of data cleaning and preprocessing ---\n")

        return JsonResponse({
            'success': "Data has been cleaned and preprocessed successfully.",
            'target_column': target_column,
            'problem_type': problem_type,
        })

    return JsonResponse({'error': "Invalid request."})

@csrf_exempt
def run_model(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            selected_model = data.get('model')
            target_type = data.get('target_type')
            features_name_target = data.get('features_name_target')
            print(f"Selected model: {selected_model}")
            print(f"Target type: {target_type}")
            print(f"Features name target: {features_name_target}")

            cleaned_data_json = request.session.get('cleaned_data')
            if not cleaned_data_json:
                return JsonResponse({"error": "No cleaned data found in session."}, status=400)

            df_cleaned = pd.read_json(StringIO(cleaned_data_json))
            print("Cleaned data loaded successfully")
            print(df_cleaned.head())  


            if selected_model == 'decision-tree':
                model, metrics = DT(df_filtered)
                results = {"accuracy": metrics[0], "precision": metrics[1],
                           "recall": metrics[2], "f1": metrics[3]}
            elif selected_model == 'svm':
                model, metrics = SVM(df_filtered)
                results = {"model_metrics": metrics}
            elif selected_model == 'random-forest':
                model, train_metric, test_metric = RF(df_filtered)
                results = {"train_metric": train_metric, "test_metric": test_metric}
            elif selected_model == 'knn':
                model, train_metric, test_metric = KNN(df_filtered)
                results = {"train_metric": train_metric, "test_metric": test_metric}
            elif selected_model == 'neural-network':
                model, metrics = MLP_model(df_filtered)
                results = {"model_metrics": metrics}
            elif selected_model == 'k-means':
                model, metrics = KMeans(df_filtered)
                results = {"model_metrics": metrics}
            elif selected_model == 'naive-bayes':
                model, accuracy, report = naive_bayes(df_filtered)
                results = {
                    "accuracy": accuracy,
                    "classification_report": report
                }
            elif selected_model == 'regression':
                results = regression_model(df_filtered)
            else:
                return JsonResponse({"error": "Unknown model."}, status=400)

            return JsonResponse({
                "results": results,
                "success": True
            })

        except Exception as e:
            print(f"Error in run_model: {e}")
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Method not allowed"}, status=405)

@csrf_exempt
def get_compatible_features(request):
    try:
        data = json.loads(request.body)
        target_type = data.get('target_type')
        
        # Get DataFrame from session
        df_json = request.session.get('df')
        if not df_json:
            return JsonResponse({'error': 'No data available'}, status=400)
        
        df = pd.read_json(df_json)
        
        # Filter features based on type
        features = []
        for column in df.columns:
            dtype = str(df[column].dtype)
            if target_type == 'regression':
                if dtype in ['int64', 'float64']:
                    features.append({
                        'name': column,
                        'dtype': dtype,
                        'unique_count': len(df[column].unique())
                    })
            elif target_type == 'classification':
                if dtype in ['object', 'category'] or (dtype in ['int64', 'float64'] and len(df[column].unique()) < 10):
                    features.append({
                        'name': column,
                        'dtype': dtype,
                        'unique_count': len(df[column].unique())
                    })
                    
        return JsonResponse({
            'features': features,
            'recommendation': detect_problem_type(df)
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

def detect_problem_type(df):
    categorical_threshold = 10
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns
    
    # Count columns that look like categorical targets
    potential_categorical_targets = len([col for col in numeric_cols 
                                      if df[col].nunique() < categorical_threshold])
    
    if len(categorical_cols) > 0 or potential_categorical_targets > 0:
        return 'classification'
    elif len(numeric_cols) > 0:
        return 'regression'
    else:
        return 'clustering'

